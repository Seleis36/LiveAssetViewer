#!/bin/sh
set -e

mkdir -p /data/tp-log

q /q/q/tick.q -p 5010 sym /data/tp-log &
TP_PID=$!

sleep 2

q /q/q/r.q -p 5011 localhost 5010 &
RDB_PID=$!

q /q/q/feed/synthetic.q -p 5012 localhost 5010 &
FEED_PID=$!

wait $TP_PID $RDB_PID $FEED_PID
