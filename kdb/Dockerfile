FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Expects kdb+ binaries placed locally before building:
#   1. Download from https://kx.com/download → Personal Edition → Linux x86_64
#   2. Unzip the archive — it produces a q/ folder
#   3. cp q/l64/q  kdb/bin/q
#   4. cp q/q.k    kdb/bin/q.k
COPY bin/q    /usr/local/bin/q
COPY bin/q.k  /usr/local/bin/q.k
RUN chmod +x /usr/local/bin/q

ENV QHOME=/usr/local/bin
ENV QLIC=/opt/kdb

WORKDIR /q

COPY q/ ./q/
COPY scripts/startup.sh ./startup.sh
RUN chmod +x startup.sh

EXPOSE 5010

VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD q -p 5010 -e "til 1" 2>/dev/null || exit 1

CMD ["./startup.sh"]
