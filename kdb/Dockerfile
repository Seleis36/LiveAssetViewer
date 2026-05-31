FROM kxsys/kdb:4.0 AS kdb

WORKDIR /q

COPY q/ ./q/
COPY scripts/startup.sh ./startup.sh
RUN chmod +x startup.sh

ENV QLIC=/opt/kdb
EXPOSE 5010

VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD q -p 5010 -e "til 1" 2>/dev/null || exit 1

CMD ["./startup.sh"]
