FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY . .
ENV PORT=7860 \
    DATA_DIR=/app/data \
    ADMIN_USER=admin
EXPOSE 7860
CMD ["sh", "start.sh"]
