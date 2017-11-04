# take default image of node boron i.e  node 6.x
FROM node:6.9.1
RUN npm i -g yarn

# create app directory in container
RUN mkdir -p /app

# set /app directory as default working directory
WORKDIR /app

# only copy package.json initially so that `RUN yarn` layer is recreated only
# if there are changes in package.json
ADD . /app/
RUN yarn

# compile to ES5
RUN yarn build

# set up dotenv
RUN echo "NODE_ENV=${NODE_ENV}\n" >> .env &&\
    echo "PORT=4001\n" >> .env &&\
    echo "JWT_SECRET=${JWT_SECRET}" >> .env &&\
    echo "PG_DB=${PG_DB}\n" >> .env &&\
    echo "PG_PORT=${PG_PORT}\n" >> .env &&\
    echo "PG_HOST=${PG_HOST}\n" >> .env &&\
    echo "PG_USER=${PG_USER}\n" >> .env &&\
    echo "PG_PASSWD=${PG_PASSWD}\n" >> .env

# expose port 4001
EXPOSE 4001

# cmd to start service
CMD [ "node", "dist/index.js" ]