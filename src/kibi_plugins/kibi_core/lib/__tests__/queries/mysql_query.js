import Promise from 'bluebird';
import expect from 'expect.js';
import sinon from 'sinon';
import MysqlQuery from '../../queries/mysql_query';

const fakeServer = {
  log: function (tags, data) {},
  config: function () {
    return {
      get: function (key) {
        if (key === 'elasticsearch.url') {
          return 'http://localhost:12345';
        } else if (key === 'kibana.index') {
          return '.kibi';
        } else {
          return '';
        }
      }
    };
  },
  plugins: {
    elasticsearch: {
      client: {
        search: function () {
          return Promise.reject(new Error('Document does not exists'));
        }
      }
    }
  }
};

const cacheMock = {
  get: function (key) { return '';},
  set: function (key, value, time) {}
};

const queryDefinition = {
  activationQuery: 'select * from x LIMIT 1',
  resultQuery: 'select * from x',
  datasource: {
    datasourceClazz: {
      getConnectionString: function () { return 'connectionString';},
      datasource: {
        datasourceParams: {
          cache_enabled: true,
          host: 'localhost',
          dbname: 'mydb'
        }
      },
      populateParameters: function () {
        return '';
      }
    }
  }
};


describe('MysqlQuery', function () {

  describe('correct arguments are passed to generateCacheKey', function () {

    it('fetchResults', function (done) {
      const mysqlQuery = new MysqlQuery(fakeServer, queryDefinition, cacheMock);
      // stub _execute queryto skip query execution
      sinon.stub(mysqlQuery, '_executeQuery', function () {
        return Promise.resolve({rows: [], fields: []});
      });

      const spy = sinon.spy(mysqlQuery, 'generateCacheKey');

      mysqlQuery.fetchResults({credentials: {username: 'fred'}}, false, 'variableX').then(function (res) {
        expect(res.results).to.eql({ bindings: []});
        expect(spy.callCount).to.equal(1);

        expect(spy.calledWithExactly('localhostmydb', 'select * from x', false, 'variableX', 'fred')).to.be.ok();

        mysqlQuery._executeQuery.restore();
        mysqlQuery.generateCacheKey.restore();
        done();
      }).catch(done);
    });

    it('checkIfItIsRelevant', function (done) {
      const mysqlQuery = new MysqlQuery(fakeServer, queryDefinition, cacheMock);
      // stub _execute queryto skip query execution
      sinon.stub(mysqlQuery, '_executeQuery', function () {
        return Promise.resolve({rows: [], fields: []});
      });

      const spy = sinon.spy(mysqlQuery, 'generateCacheKey');

      mysqlQuery.checkIfItIsRelevant({credentials: {username: 'fred'}}).then(function (res) {
        expect(res).to.equal(false);
        expect(spy.callCount).to.equal(1);

        expect(spy.calledWithExactly('localhostmydb', 'select * from x LIMIT 1', 'fred')).to.be.ok();

        mysqlQuery._executeQuery.restore();
        mysqlQuery.generateCacheKey.restore();
        done();
      }).catch(done);
    });

  });

});
