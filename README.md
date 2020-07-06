# websocket-poc

## Building
run `npm run build` to build the binary (set for linux binaries. see zeit/pkg for building for other environments)

## Running
run `./test-app server` to run the websocket server; then
run `./test-app client --url http://domain.com` (in another machine) to run a client that will connect to the server and continuously send message every 5 secs
