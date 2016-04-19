FROM node:4.2.1
MAINTAINER Maurits van Mastrigt <maurits@kukua.cc>

WORKDIR /data
COPY ./ /data/

RUN touch /spul.log
RUN npm install --global bunyan
RUN npm install
RUN npm run compile

CMD npm start
