const childProcess = require('child_process');
const fs = require('fs');
const Promise = require('bluebird');
const rp = require('request-promise');
const http = require('http');
const path = require('path');
const _ = require('lodash');
const os = require('os');

function GremlinServerHandler(server) {
  this.gremlinServer = null;
  this.initialized = false;
  this.server = server;
  this.javaChecked = false;
}

function startServer(self, fulfill, reject) {
  const config = self.server.config();
  let gremlinServerPath = config.get('kibi_core.gremlin_server.path');

  if (gremlinServerPath) {
    isJavaVersionOk(self).then(function () {
      self.server.plugins.elasticsearch.client.nodes.info({ nodeId: '_local' }).then(function (response) {
        let esTransportAddress = null;
        _.each(response.nodes, (node) => {
          esTransportAddress = node.transport_address;
        });
        if (!esTransportAddress) {
          return Promise.reject(new Error('Unable to get the transport address'));
        }

        const esClusterName = response.cluster_name;
        self.url = config.get('kibi_core.gremlin_server.url');

        if (config.get('kibi_core.gremlin_server.ssl.ca')) {
          self.ca = fs.readFileSync(config.get('kibi_core.gremlin_server.ssl.ca'));
        }

        if (path.parse(gremlinServerPath).ext !== '.jar') {
          self.server.log(['gremlin', 'error'], 'The configuration property kibi_core.gremlin_server.path does not point to a jar file');
          return Promise.reject(new Error('The configuration property kibi_core.gremlin_server.path does not point to a jar file'));
        }

        if (!path.isAbsolute(gremlinServerPath)) {
          const rootDir = path.normalize(__dirname + path.sep + '..' + path.sep + '..' + path.sep + '..' + path.sep);
          const gremlinDirtyDir = path.join(rootDir, gremlinServerPath);
          gremlinServerPath = path.resolve(path.normalize(gremlinDirtyDir));
        }

        return fs.access(gremlinServerPath, fs.F_OK, (error) => {
          if (error !== null) {
            self.server.log(['gremlin', 'error'], 'The Kibi Gremlin Server jar file was not found. Please check the configuration');
            return Promise.reject(new Error('The Kibi Gremlin Server jar file was not found. Please check the configuration'));
          }
          const loggingFilePath = path.parse(gremlinServerPath).dir + path.sep + 'gremlin-es2-server-log.properties';

          const [ host, port, ...rest ] = esTransportAddress.split(':');
          const transportClientUsername = config.get('kibi_core.elasticsearch.transport_client.username');
          const transportClientPassword = config.get('kibi_core.elasticsearch.transport_client.password');

          const args = [
            '-jar', gremlinServerPath,
            '--elasticNodeHost=' + host,
            '--elasticNodePort=' + port,
            '--elasticClusterName=' + esClusterName,
            '--server.port=' + self.url.split(':')[2],
            '--logging.config=' + loggingFilePath
          ];

          if (transportClientUsername) {
            args.push('--elasticTransportClientUserName=' + transportClientUsername);
            args.push('--elasticTransportClientPassword=' + transportClientPassword);
          }

          if (config.get('kibi_core.gremlin_server.ssl.key_store')) {
            args.push('--server.ssl.enabled=true');
            args.push('--server.ssl.key-store=' + config.get('kibi_core.gremlin_server.ssl.key_store'));
            args.push('--server.ssl.key-store-password=' + config.get('kibi_core.gremlin_server.ssl.key_store_password'));
          } else if (config.get('server.ssl.key') && config.get('server.ssl.cert')) {
            const msg = 'Since you are using Elasticsearch Shield, you should configure the SSL ' +
              'for the gremlin server by setting the key store at kibi_core.gremlin_server.ssl.key_store.';
            self.server.log(['gremlin','error'], msg);
            return Promise.reject(new Error(msg));
          }

          self.server.log(['gremlin', 'info'], 'Starting the Kibi gremlin server');
          self.gremlinServer = childProcess.spawn('java', args);
          self.gremlinServer.stderr.on('data', (data) => self.server.log(['gremlin', 'error'], ('' + data).trim()));
          self.gremlinServer.stdout.on('data', (data) => self.server.log(['gremlin', 'info'], ('' + data).trim()));
          self.gremlinServer.on('error', (err) => reject);

          const counter = 15;
          const timeout = 5000;

          self.ping = function (counter) {
            if (counter > 0) {
              setTimeout(function () {
                self._ping()
                .then(function (resp) {
                  const jsonResp = JSON.parse(resp.toString());
                  if (jsonResp.status === 'ok') {
                    self.server.log(['gremlin', 'info'], 'Kibi gremlin server running at ' + self.url);
                    self.initialized = true;
                    fulfill({ message: 'The Kibi gremlin server started successfully.' });
                  } else {
                    self.server.log(['gremlin', 'warning'], 'Waiting for the Kibi gremlin server');
                    counter--;
                    setTimeout(self.ping(counter), timeout);
                  }
                })
                .catch(function (err) {
                  if (err.error.code !== 'ECONNREFUSED') {
                    self.server.log(['gremlin', 'error'], 'Failed to ping the Kibi gremlin server: ' + err.message);
                  } else {
                    self.server.log(['gremlin', 'warning'], 'Waiting for the Kibi gremlin server');
                  }
                  counter--;
                  setTimeout(self.ping(counter), timeout);
                });
              }, timeout);
            } else {
              self.server.log(['gremlin', 'error'], 'The Kibi gremlin server did not start correctly');
              reject(new Error('The Kibi gremlin server did not start correctly'));
            }
          };
          self.ping(counter);
        });
      }).catch(reject);
    });
  } else {
    self.server.log(['gremlin', 'warning'], 'The configuration property kibi_core.gremlin_server.path is empty');
    fulfill({ message: 'The Kibi gremlin server was not started.', error: true });
  }
};

function isJavaVersionOk(self) {
  return new Promise((fulfill, reject) => {
    let spawn = require('child_process').spawn('java', ['-version']);
    spawn.on('error', function (err) {
      self.server.log(['gremlin', 'error'], err);
    });
    spawn.stderr.on('data', function (data) {
      var result = _checkJavaVersionString(data);
      if (result) {
        if (result.v) {
          fulfill(true);
        } else {
          self.server.log(['gremlin', 'error'], result.e);
          reject(new Error(result.e));
        }
      }
    });
  });
}

GremlinServerHandler.prototype._checkJavaVersionString = function (string) {
  if (!this.javaChecked) {
    let ret = {};
    string = string.toString().split(JSON.stringify(os.EOL))[0];
    let javaVersion = new RegExp('java version').test(string) ? string.split(' ')[2].replace(/"/g, '') : false;
    if (javaVersion) {
      if (javaVersion.startsWith('1.8')) {
        ret.v = true;
      } else {
        ret.v = false;
        ret.e = 'JAVA version is lower than the requested 1.8. The Kibi Gremlin Server needs JAVA 8 to run';
      }
    } else {
      ret.v = false;
      ret.e = 'JAVA not found. Please install JAVA 8 and restart Kibi';
    }
    this.javaChecked = true;
    return ret;
  } else {
    return null;
  }
}

GremlinServerHandler.prototype.start = function () {
  const self = this;

  if (self.initialized) {
    return Promise.resolve({
      message: 'GremlinServerHandler already initialized'
    });
  }

  return new Promise((fulfill, reject) => {
    let elasticsearchStatus = self.server.plugins.elasticsearch.status;

    if (elasticsearchStatus.state === 'green') {
      startServer(self, fulfill, reject);
    }
    elasticsearchStatus.on('change', function (prev, prevmsg) {
      if (elasticsearchStatus.state === 'green') {
        if (!self.initialized) {
          startServer(self, fulfill, reject);
        } else {
          fulfill({ message: 'GremlinServerHandler already initialized' });
        }
      }
    });
  });
};

GremlinServerHandler.prototype.stop = function () {
  const self = this;

  self.initialized = false;
  return new Promise(function (fulfill, reject) {
    self.server.log(['gremlin', 'info'], 'Stopping the Kibi gremlin server');

    if (self.gremlinServer) {
      let exitCode = self.gremlinServer.kill('SIGINT');
      if (exitCode) {
        self.server.log(['gremlin', 'info'], 'The Kibi gremlin server exited successfully');
        fulfill(true);
      } else {
        self.server.log(['gremlin', 'error'], 'The Kibi gremlin server exited with non zero status: ' + exitCode);
        reject(new Error('The Kibi gremlin server exited with non zero status: ' + exitCode));
      }
    } else {
      fulfill(true);
    }
  });
};

GremlinServerHandler.prototype._ping = function () {
  const options = {
    method: 'GET',
    uri: this.url + '/ping'
  };
  if (this.ca) {
    options.ca = this.ca;
  }
  return rp(options);
};

module.exports = GremlinServerHandler;
