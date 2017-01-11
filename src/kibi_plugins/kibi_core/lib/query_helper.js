import url from 'url';
import Promise from 'bluebird';
import _ from 'lodash';
import logger from './logger';

function QueryHelper(server) {
  this.server = server;
  this.config = server.config();
  this.log = logger(server, 'query_helper');
  this.client = server.plugins.elasticsearch.client;
}

QueryHelper.prototype.replaceVariablesForREST = function (headers, params, body, path, uri, variables, credentials) {
  // clone here !!! headers, params, body
  // so the original one in the config are not modified
  const h = _.cloneDeep(headers);
  const p = _.cloneDeep(params);
  let b = _.cloneDeep(body);
  let pa = _.cloneDeep(path);

  const self = this;
  // first try to replace placeholders using variables
  if (variables) {
    for (const name in variables) {
      if (variables.hasOwnProperty(name)) {
        const regex = new RegExp(self._escapeRegexSpecialCharacters(name), 'g');

        b = b.replace(regex, variables[name]);
        pa = pa.replace(regex, variables[name]);

        let i;
        for (i = 0; i < h.length; i++) {
          h[i].value = h[i].value.replace(regex, variables[name]);
        }

        for (i = 0; i < p.length; i++) {
          p[i].value = p[i].value.replace(regex, variables[name]);
        }

      }
    }
  }

  // second replace placeholders based on selected entity uri
  const promises = [
    self.replaceVariablesUsingEsDocument(h, uri, credentials),
    self.replaceVariablesUsingEsDocument(p, uri, credentials),
    self.replaceVariablesUsingEsDocument(b, uri, credentials),
    self.replaceVariablesUsingEsDocument(pa, uri, credentials)
  ];

  return Promise.all(promises).then(function (results) {
    return {
      headers: results[0],
      params: results[1],
      body: results[2],
      path: results[3]
    };
  });
};

/**
 * s can be either a string or (key, value) map
 */
QueryHelper.prototype.replaceVariablesUsingEsDocument = function (s, uri, credentials, datasource) {
  const self = this;
  if (!uri || uri.trim() === '') {
    return Promise.resolve(s);
  }

  const parts = uri.trim().split('/');
  if (parts.length < 3) {
    return Promise.reject(new Error('Malformed uri - should have at least 3 parts: index, type, id'));
  }

  const index = parts[0];
  const type = parts[1];
  const id = parts[2];

  return self.fetchDocument(index, type, id, credentials).then(function (doc) {
    //now parse the query and replace the placeholders
    if (typeof s === 'string' || s instanceof String) {
      return self._replaceVariablesInTheQuery(doc, s, datasource);
    } else {
      // array of objects with name value
      for (let i = 0; i < s.length; i++) {
        s[i].value = self._replaceVariablesInTheQuery(doc, s[i].value, datasource);
      }
      return s;
    }
  });
};

QueryHelper.prototype.fetchDocument = function (index, type, id, credentials) {
  const self = this;
  let client = self.client;
  if (credentials) {
    // Every time we fetch document for index different then .kibi one we need a client with logged in user credentials
    client = self.server.plugins.elasticsearch.createClient(credentials);
  }
  return client.search({
    index: index,
    type: type,
    q: '_id: "' + id + '"'
  }).then(function (doc) {
    if (doc.hits && doc.hits.hits.length === 1) {
      return doc.hits.hits[0];
    }
    return Promise.reject(new Error('No document matching _id=' + id + ' was found'));
  })
  .catch(function (err) {
    const msg = 'Could not fetch document [/' + index + '/' + type + '/' + id + '], check logs for details please.';
    self.log.warn(msg);
    self.log.warn(err);
    return Promise.reject(new Error(msg));
  });
};

/**
 * Replace variable placeholders
 * Currently supported syntax:
 *    @doc[_source][id]@
 *
 */
QueryHelper.prototype._replaceVariablesInTheQuery = function (doc, query, datasource) {
  const self = this;
  let ret = query;
  const regex = /(@doc\[.+?\]@)/g;
  let match = regex.exec(query);

  while (match !== null) {
    let group = match[1];
    group = group.replace('@doc', '');
    group = group.substring(0, group.length - 1);

    let value;
    if (group === '[_id]' && datasource === 'tinkerpop3_query') {
      const id = self._getValue(doc, group);
      const index = self._getValue(doc, '[_index]');
      const type = self._getValue(doc, '[_type]');
      value = index + '/' + type + '/' + id;
    } else {
      value = self._getValue(doc, group);
    }

    const reGroup = self._escapeRegexSpecialCharacters(match[1]);
    const re = new RegExp(reGroup, 'g');
    ret = ret.replace(re, value);

    match = regex.exec(query);
  }

  return ret;
};

QueryHelper.prototype._escapeRegexSpecialCharacters = function (s) {
  return s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
};

QueryHelper.prototype._getValue = function (doc, group) {
  // parse a group and get the value from doc
  let value = null;
  const regex = /(\[[^\[\]].*?\])/g;
  let match = regex.exec(group);
  let i = 1;
  while (match !== null) {
    let propertyName =  match[1];
    // strip brackets
    propertyName = propertyName.substring(1, propertyName.length - 1);
    if (i === 1) {
      value = doc[propertyName];
    } else {
      value = value[propertyName];
    }
    i++;
    match = regex.exec(group);
  }
  return value;
};

QueryHelper.prototype.fetchDocuments = function (type) {
  const self = this;
  return self.client.search({
    index: self.config.get('kibana.index'),
    type: type,
    size: 100
  });
};

module.exports = QueryHelper;
