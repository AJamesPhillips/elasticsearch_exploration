#!/bin/bash

LABEL="dev.exploration=es1"
ELASTICSEARCH="elasticsearch-for-exploration"
RUNNING_ID=`docker ps -aq --filter="label=${LABEL}" --filter="name=${ELASTICSEARCH}" --filter="status=running"`
STOPPED_ID=`docker ps -aq --filter="label=${LABEL}" --filter="name=${ELASTICSEARCH}" --filter="status=exited" --filter="status=created"`

if [ ${RUNNING_ID} ]; then
  echo "Elasticsearch running in ${RUNNING_ID}"
else
  if [ ${STOPPED_ID} ]; then
    echo "Found stopped Elasticsearch container ${STOPPED_ID}. Restarting..."
    docker start ${STOPPED_ID}
  else
    echo "Starting a new instance of Elasticsearch..."
    docker run -d \
      --name elasticsearch-for-exploration \
      -p 9600:9200 \
      --label=${LABEL} \
      docker.elastic.co/elasticsearch/elasticsearch:6.0.1
  fi
fi
