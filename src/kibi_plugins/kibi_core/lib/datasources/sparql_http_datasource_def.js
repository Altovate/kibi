import util from 'util';
import AbstractDatasourceDef from './abstract_datasource_def';
import datasourcesSchema from '../datasources_schema';

function SparqlHttpDatasourceDef(server, datasource) {
  AbstractDatasourceDef.call(this, server, datasource);
  this.schema = datasourcesSchema.sparql_http.concat(datasourcesSchema.base);
}

util.inherits(SparqlHttpDatasourceDef, AbstractDatasourceDef);

SparqlHttpDatasourceDef.prototype.getConnectionString = function () {
  return this.populateParameters('${endpoint_url}');
};

module.exports = SparqlHttpDatasourceDef;
