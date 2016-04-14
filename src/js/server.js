import fs from 'fs'
import path from 'path'
import {exec} from 'child_process'
import express from 'express'
import Handlebars from 'handlebars'
import parallel from 'node-parallel'
import mysql from 'mysql'
import _ from 'underscore'

var app = express()
var templatePath = path.resolve(__dirname, '../../src/tpl/index.hbs')
var template = Handlebars.compile(fs.readFileSync(templatePath, 'utf8'))
const range = 24 * 60 * 60 * 1000 // milliseconds
const timeout = 10 * 1000 // milliseconds
const port = 9000

app.get('/',  (req, res) => {
	var since = new Date(Date.now() - range)
	var devices = {}
	var addDevice = (id) => {
		devices[id] = { id, name: '', spulCount: 0, storageCount: 0 }
	}

	// Floor to round hour
	since.setMinutes(0)
	since.setSeconds(0)
	since.setMilliseconds(0)

	var timestamp = since.getTime() / 1000
	var p = parallel().timeout(timeout)

	// Query SPUL buffers
	p.add((done) => {
		var container = process.env['SPUL_CONTAINER']
		var max = process.env['SPUL_LOG_LIMIT']
		var cmd = `
			docker logs "${container}" 2>/dev/null \
			| tail -n"${max}" \
			| grep "buffer:" \
			| awk "{print $2 $4}"` // "<timestamp>,<device id>\n"

		exec(cmd, (err, stdout) => {
			if (err) return done(err)

			_.each(stdout.split('\n'), (row) => {
				var values = row.split(',')
				if (parseInt(values[0], 10) >= timestamp) {
					var id = values[1]
					if ( ! devices[id]) addDevice(id)
					devices[id].spulCount += 1
				}
			})

			done()
		})
	})

	// Query storage records
	p.add((done) => {
		var client = mysql.createConnection({
			host: process.env['MYSQL_HOST'],
			user: process.env['MYSQL_USER'],
			password: process.env['MYSQL_PASSWORD'],
			database: process.env['MYSQL_DATABASE']
		})

		client.query('SHOW TABLES', (err, tables) => {
			if (err) return done(err)

			tables = _.flatten(_.map(tables, _.values))
			var sql = 'SELECT ' + _.map(tables, (table) => `
				(SELECT COUNT(*) FROM \`${table}\`
				WHERE timestamp >= FROM_UNIXTIME(${timestamp})
				LIMIT 1)
				AS \`${table}\``).join(',')

			client.query(sql, (err, counts) => {
				client.destroy()

				if (err) return done(err)

				_.each(counts[0], (count, id) => {
					if ( ! devices[id]) addDevice(id)

					devices[id].storageCount += count
				})

				done()
			})
		})
	})

	p.done((err) => {
		if (err) console.error(err)

		devices = _.sortBy(_.values(devices), (device) => device.id)

		// Determine names
		var namesFile = path.resolve(__dirname, '../../names.json')

		if (fs.existsSync(namesFile)) {
			var names = require(namesFile)
			_.each(devices, (device) => { device.name = names[device.id] || '' })
		}

		// Render template
		res.send(template({ err, since, devices }))
	})
})

app.listen(port)
console.log('Listening on port', port)
