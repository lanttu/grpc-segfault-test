const protobuf = require('protobufjs');
const Grpc = require('grpc');
const H = require('highland');
const _ = require('lodash');
const stream = require('stream');

const protoJson = protobuf.loadSync('test.proto.json');

const grpc = Grpc.loadObject(protoJson);

const server = new Grpc.Server();
server.addService(grpc.test.TestService.service, {
  requestStream: (call, callback) => {
    let lastId = -1;
    let errored = false;
    call.on('data', data => {
      console.info('d', data);
      lastId = data.id;
      if (data.error) {
        const err = new Error(data.error);
        callback(err);
        errored = true;
      }
    });
    call.on('end', () => {
      if (!errored) {
        callback(null, { id: lastId });
      }
    });
  },
})

server.bind('0.0.0.0:8111', Grpc.ServerCredentials.createInsecure());
server.start();

function run() {
  const client = new grpc.test.TestService('localhost:8111', Grpc.credentials.createInsecure());
  const errorId = 20;
  const input = H(_.range(40).map(id => ({ id, error: id === errorId ? 'Fails' : null })))
  .ratelimit(1, 5).pipe(new stream.PassThrough({ objectMode: true }));
  const call = client.requestStream((err, res) => {
    console.info(err, res);
    //input.unpipe(call); // Works if you uncomment this
  });
  input.pipe(call);
}
run();
