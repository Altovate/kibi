var util = require('util');
var AbstractDatasourceDef = require('./abstract_datasource_def');
var datasourcesSchema = require('../datasources_schema');


function MysqlDatasourceDef(server, datasource) {
  AbstractDatasourceDef.call(this, server, datasource);
  this.schema = datasourcesSchema.mysql.concat(datasourcesSchema.base);
}

util.inherits(MysqlDatasourceDef, AbstractDatasourceDef);

MysqlDatasourceDef.prototype.getConnectionString = function () {
  return this.populateParameters('mysql://${username}:${password}@${host}/${dbname}');
};

module.exports = MysqlDatasourceDef;
