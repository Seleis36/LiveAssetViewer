#!/bin/sh
set -e

# Start tickerplant in the background, then start the RDB
q q/tick.q sym /data/tp-log -p 5010 &
TP_PID=$!

sleep 2

q q/r.q localhost 5010 -p 5011 &
RDB_PID=$!

# Start synthetic feed
q q/feed/synthetic.q localhost 5010

wait $TP_PID $RDB_PID
