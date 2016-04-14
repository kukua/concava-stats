# ConCaVa Stats

> Statistics page for ConCaVa measurements.

## Setup

```bash
git clone https://github.com/kukua/concava-stats.git
cd concava-stats
cp .env.sample .env
chmod 600 .env
# > Edit .env

docker-compose up -d

# Local testing:
eval $(cat .env | sed 's/MYSQL_/export MYSQL_/g')
npm install
npm run compile
npm start
```

## Notes

- Create `names.json` with `{ "<device id>": "<name>" }` format to add names.
