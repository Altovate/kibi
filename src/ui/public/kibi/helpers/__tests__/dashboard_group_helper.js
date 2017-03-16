import noDigestPromises from 'test_utils/no_digest_promises';
import DashboardGroupHelperProvider from 'ui/kibi/helpers/dashboard_group_helper';
import Promise from 'bluebird';
import expect from 'expect.js';
import ngMock from 'ng_mock';
import MockState from 'fixtures/mock_state';
import mockSavedObjects from 'fixtures/kibi/mock_saved_objects';
import sinon from 'auto-release-sinon';
import chrome from 'ui/chrome';

const fakeSavedDashboards = [
  {
    id: 'Articles',
    title: 'Articles'
  },
  {
    id: 'Companies',
    title: 'Companies'
  },
  {
    id: 'time-testing-1',
    title: 'time testing 1',
    timeRestore: false
  },
  {
    id: 'time-testing-2',
    title: 'time testing 2',
    timeRestore: true,
    timeMode: 'quick',
    timeFrom: 'now-15y',
    timeTo: 'now'
  },
  {
    id: 'time-testing-3',
    title: 'time testing 3',
    timeRestore: true,
    timeMode: 'absolute',
    timeFrom: '2005-09-01T12:00:00.000Z',
    timeTo: '2015-09-05T12:00:00.000Z'
  }
];
const fakeSavedDashboardGroups = [
  {
    id: 'group-1',
    title: 'Group 1',
    priority: 1,
    dashboards: [
      {
        title: 'Companies',
        id: 'Companies'
      },
      {
        id: 'Articles',
        title: 'Articles'
      }
    ]
  },
  {
    id: 'group-2',
    title: 'Group 2',
    priority: 2,
    dashboards: []
  }
];
const fakeSavedDashboardsForCounts = [
  {
    id: 'Articles',
    title: 'Articles'
  },
  {
    id: 'search-ste',
    title: 'search-ste',
    savedSearchId: 'search-ste'
  },
  {
    id: 'time-testing-4',
    title: 'time-testing-4',
    timeRestore: true,
    timeFrom: '2005-09-01T12:00:00.000Z',
    timeTo: '2015-09-05T12:00:00.000Z',
    savedSearchId: 'time-testing-4'
  }
];
const fakeSavedSearches = [
  {
    id: 'search-ste',
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify(
        {
          index: 'search-ste',
          filter: [],
          query: {}
        }
      )
    }
  },
  {
    id: 'time-testing-4',
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify(
        {
          index: 'time-testing-4', // here put this id to make sure fakeTimeFilter will supply the timfilter for it
          filter: [],
          query: {}
        }
      )
    }
  }
];

let dashboardGroupHelper;
let appState;
let kibiState;
let $httpBackend;

function init({ currentDashboardId = 'Articles', indexPatterns, savedDashboards, savedDashboardGroups, savedSearches } = {}) {
  ngMock.module('kibana', function ($provide) {
    $provide.constant('kibiEnterpriseEnabled', false);
    $provide.constant('kbnDefaultAppId', 'dashboard');
    $provide.constant('kibiDefaultDashboardTitle', 'Articles');

    appState = new MockState({ filters: [] });
    $provide.service('getAppState', () => {
      return function () { return appState; };
    });
  });

  ngMock.module('app/dashboard', function ($provide) {
    $provide.service('savedDashboards', (Promise, Private) => {
      return mockSavedObjects(Promise, Private)('savedDashboard', savedDashboards || []);
    });
  });

  ngMock.module('kibana/index_patterns', function ($provide) {
    $provide.service('indexPatterns', (Promise, Private) => mockSavedObjects(Promise, Private)('indexPatterns', indexPatterns || []));
  });

  ngMock.module('dashboard_groups_editor/services/saved_dashboard_groups', function ($provide) {
    $provide.service('savedDashboardGroups', (Promise, Private) => {
      return mockSavedObjects(Promise, Private)('savedDashboardGroups', savedDashboardGroups || []);
    });
  });

  ngMock.module('discover/saved_searches', function ($provide) {
    $provide.service('savedSearches', (Promise, Private) => mockSavedObjects(Promise, Private)('savedSearches', savedSearches || []));
  });

  ngMock.inject(function ($injector, _kibiState_, Private) {
    kibiState = _kibiState_;
    dashboardGroupHelper = Private(DashboardGroupHelperProvider);
    sinon.stub(chrome, 'getBasePath').returns('');
    sinon.stub(kibiState, '_getCurrentDashboardId').returns(currentDashboardId);
    $httpBackend = $injector.get('$httpBackend');
  });
}

describe('Kibi Components', function () {
  describe('DashboardGroupHelper', function () {

    noDigestPromises.activateForSuite();

    describe('copy', function () {
      beforeEach(init);

      it('copy src dashboard groups', function () {
        const src = [
          {
            id: 'group1',
            active: true,
            hide: false,
            iconCss: 'icon aaa',
            iconUrl: 'icon aaa',
            priority: 1,
            title: 'title 1',
            selected: { id: 'd1' },
            dashboards: [ { id: 'd1' } ]
          },
          {
            id: 'group2',
            active: true,
            hide: false,
            iconCss: 'icon aaa',
            iconUrl: 'icon aaa',
            priority: 2,
            title: 'title 2',
            selected: { id: 'd2' },
            dashboards: [ { id: 'd2' } ]
          }
        ];
        const dst = [
          {
            id: 'group1',
            active: false,
            hide: true,
            iconCss: 'icon bbb',
            iconUrl: 'icon bbb',
            priority: -1,
            title: 'title 0',
            selected: { id: 'd0' },
            dashboards: [ { id: 'd0' } ]
          },
          {
            id: 'group3',
            active: true,
            hide: false,
            iconCss: 'icon aaa',
            iconUrl: 'icon aaa',
            priority: 3,
            title: 'title 3',
            selected: { id: 'd3' },
            dashboards: [ { id: 'd3' } ]
          }
        ];

        dashboardGroupHelper.copy(src, dst);
        expect(dst).to.have.length(2);

        expect(dst[0].id).to.be('group1');
        expect(dst[0].active).to.be(true);
        expect(dst[0].hide).to.be(false);
        expect(dst[0].iconCss).to.be('icon aaa');
        expect(dst[0].iconUrl).to.be('icon aaa');
        expect(dst[0].priority).to.be(1);
        expect(dst[0].title).to.be('title 1');
        expect(dst[0].dashboards).to.have.length(1);
        expect(dst[0].dashboards[0].id).to.be('d1');

        expect(dst[1].id).to.be('group2');
        expect(dst[1].active).to.be(true);
        expect(dst[1].hide).to.be(false);
        expect(dst[1].iconCss).to.be('icon aaa');
        expect(dst[1].iconUrl).to.be('icon aaa');
        expect(dst[1].priority).to.be(2);
        expect(dst[1].title).to.be('title 2');
      });

      it('save metadata from dest groups', function () {
        const src = [
          {
            id: 'group1',
            selected: { id: 'd1' },
            dashboards: [ { id: 'd1' }, { id: 'd2' } ]
          }
        ];
        const dst = [
          {
            id: 'group1',
            selected: {
              id: 'd1',
              count: 123,
              filterIconMessage: 'filter that',
              isPruned: true,
            },
            dashboards: [
              {
                id: 'd0'
              },
              {
                id: 'd1',
                count: 123,
                filterIconMessage: 'filter that',
                isPruned: true,
              },
              {
                id: 'd2',
                count: 456,
                filterIconMessage: 'filter this',
                isPruned: false,
              }
            ]
          }
        ];

        dashboardGroupHelper.copy(src, dst);
        expect(dst).to.have.length(1);

        expect(dst[0].id).to.be('group1');
        expect(dst[0].selected.count).to.be(123);
        expect(dst[0].selected.filterIconMessage).to.be('filter that');
        expect(dst[0].selected.isPruned).to.be(true);
        expect(dst[0].dashboards).to.have.length(2);
        expect(dst[0].dashboards[0].id).to.be('d1');
        expect(dst[0].dashboards[0].count).to.be(123);
        expect(dst[0].dashboards[0].filterIconMessage).to.be('filter that');
        expect(dst[0].dashboards[0].isPruned).to.be(true);
        expect(dst[0].dashboards[1].id).to.be('d2');
        expect(dst[0].dashboards[1].count).to.be(456);
        expect(dst[0].dashboards[1].filterIconMessage).to.be('filter this');
        expect(dst[0].dashboards[1].isPruned).to.be(false);
      });
    });

    describe('Simple tests', function () {
      beforeEach(() => init({
        savedDashboards: fakeSavedDashboards,
        savedDashboardGroups: fakeSavedDashboardGroups,
        savedSearches: fakeSavedSearches
      }));

      it('shortenDashboardName should shorten', function () {
        expect(dashboardGroupHelper.shortenDashboardName('TEST', 'TEST dashboard')).to.be('dashboard');
        expect(dashboardGroupHelper.shortenDashboardName('TEST', 'TEST-dashboard')).to.be('dashboard');
      });

      it('shortenDashboardName should not shorten', function () {
        expect(dashboardGroupHelper.shortenDashboardName('BLA', 'TEST dashboard')).to.be('TEST dashboard');
        expect(dashboardGroupHelper.shortenDashboardName('BLA', 'TEST-dashboard')).to.be('TEST-dashboard');
      });

      it('_getListOfDashboardsFromGroups', function () {
        const dA = {id: 'A'};
        const dB = {id: 'B'};
        const dC = {id: 'C'};
        const groups = [
          {
            dashboards: [dA, dB]
          },
          {
            dashboards: [dA, dB, dC]
          }
        ];

        const actual = dashboardGroupHelper._getListOfDashboardsFromGroups(groups);
        expect(actual.length).to.be(3);
        expect(actual[0]).to.be(dA);
        expect(actual[1]).to.be(dB);
        expect(actual[2]).to.be(dC);
      });

      it('getIdsOfDashboardGroupsTheseDashboardsBelongTo - there is a group with a dashboard', function (done) {
        const dashboardIds = ['Articles'];
        const expected = ['group-1'];

        dashboardGroupHelper.getIdsOfDashboardGroupsTheseDashboardsBelongTo(dashboardIds).then(function (groupIds) {
          expect(groupIds).to.eql(expected);
          done();
        }).catch(done);
      });

      it('getIdsOfDashboardGroupsTheseDashboardsBelongTo - there is NOT a group with a dashboard', function (done) {
        const dashboardIds = ['ArticlesXXX'];

        dashboardGroupHelper.getIdsOfDashboardGroupsTheseDashboardsBelongTo(dashboardIds).then(function (groupIds) {
          expect(groupIds).to.eql([]);
          done();
        }).catch(done);
      });
    });

    describe('compute groups', function () {
      describe('on no dashboard', function () {
        beforeEach(() => init({
          currentDashboardId: '',
          savedDashboards: fakeSavedDashboards,
          savedDashboardGroups: fakeSavedDashboardGroups,
          savedSearches: fakeSavedSearches
        }));

        it('no current dashboard', function (done) {
          dashboardGroupHelper.computeGroups().then(function (groups) {
            // computeGroups should return all 5 groups, even when no dashboard is selected
            expect(groups).to.have.length(5);
            done();
          }).catch(done);
        });
      });

      describe('for the current dashboard Articles', function () {
        beforeEach(() => init({
          savedDashboards: fakeSavedDashboards,
          savedDashboardGroups: fakeSavedDashboardGroups,
          savedSearches: fakeSavedSearches
        }));

        it('computeGroups 1', function (done) {
          dashboardGroupHelper.computeGroups().then(function (groups) {

            expect(groups).to.have.length(5);

            expect(groups[0].title).to.equal('Group 1');
            expect(groups[0].dashboards).to.have.length(2);
            expect(groups[0].dashboards[0].id).to.match(/^Companies|Articles$/);
            expect(groups[0].dashboards[1].id).to.match(/^Companies|Articles$/);

            expect(groups[1].title).to.equal('Group 2');
            expect(groups[1].dashboards).to.have.length(0);

            expect(groups[2].title).to.equal('time testing 1');
            expect(groups[2].dashboards).to.have.length(1);
            expect(groups[2].dashboards[0].id).to.equal('time-testing-1');
            expect(groups[2].dashboards[0].title).to.equal('time testing 1');

            expect(groups[3].title).to.equal('time testing 2');
            expect(groups[3].dashboards).to.have.length(1);
            expect(groups[3].dashboards[0].id).to.equal('time-testing-2');
            expect(groups[3].dashboards[0].title).to.equal('time testing 2');

            expect(groups[4].title).to.equal('time testing 3');
            expect(groups[4].dashboards).to.have.length(1);
            expect(groups[4].dashboards[0].id).to.equal('time-testing-3');
            expect(groups[4].dashboards[0].title).to.equal('time testing 3');

            done();
          }).catch(done);
        });
      });

      describe('dashboards do not exist', function () {
        beforeEach(() => init({ savedDashboardGroups: fakeSavedDashboardGroups }));

        it('computeGroups 2', function (done) {
          dashboardGroupHelper.computeGroups()
          .then(() => done('this should fail'))
          .catch(function (err) {
            // here if there are groups but there is no dashboards we should get an error
            expect(err.message).to.be(
              '"Group 1" dashboard group contains non existing dashboard "Companies". Edit dashboard group to remove non existing dashboard'
            );
            done();
          });
        });
      });

      describe('no dashboards groups', function () {
        beforeEach(() => init({ savedDashboards: fakeSavedDashboards, savedSearches: fakeSavedSearches }));

        it('computeGroups 3', function (done) {
          dashboardGroupHelper.computeGroups().then(function (groups) {
            // here if there are no groups but there are 5 dashboards we expect 5 pseudo group created
            expect(groups).to.have.length(5);
            done();
          }).catch(done);
        });
      });

      describe('no dashboards groups, no dashboards', function () {
        beforeEach(() => init({ savedSearches: fakeSavedSearches }));

        it('computeGroups 4', function (done) {
          dashboardGroupHelper.computeGroups().then(function (groups) {
            // here if there are no groups but there are 5 dashboards we expect 5 pseudo group created
            expect(groups).to.have.length(0);
            done();
          }).catch(done);
        });
      });
    });

    describe('getDashboardsMetadata', function () {
      beforeEach(() => init({
        indexPatterns: [
          {
            id: 'time-testing-4',
            timeField: 'date',
            fields: [
              {
                name: 'date',
                type: 'date'
              }
            ]
          }
        ],
        savedDashboards: fakeSavedDashboardsForCounts,
        savedSearches: fakeSavedSearches
      }));

      it('dashboard does NOT exist', function (done) {
        dashboardGroupHelper.getDashboardsMetadata(['dash-do-not-exist']).then(function (meta) {
          expect(meta).to.eql([]);
          done();
        }).catch(done);
      });

      it('dashboard exist but has no savedSearch', function (done) {
        dashboardGroupHelper.getDashboardsMetadata(['Articles']).then(function (meta) {
          expect(meta).to.eql([]);
          done();
        }).catch(done);
      });

      it('dashboard exist and it has savedSearch but index does not exists', function (done) {
        dashboardGroupHelper.getDashboardsMetadata(['search-ste']).then(function (meta) {
          done(new Error('Should fail'));
        }).catch(function (err) {
          expect(err.message).equal('Could not find object with id: search-ste');
          done();
        });
      });

      it('dashboard exist and it has savedSearch and index exists', function (done) {

        $httpBackend.whenPOST('/elasticsearch/_msearch?getCountsOnTabs').respond(200, {
          responses: [
            {
              hits: {
                total: 42
              }
            }
          ]
        });

        dashboardGroupHelper.getDashboardsMetadata(['time-testing-4']).then(function (metas) {
          expect(metas.length).to.equal(1);
          expect(metas[0].count).to.equal(42);
          expect(metas[0].isPruned).to.equal(false);
          expect(metas[0].dashboardId).to.equal('time-testing-4');
          expect(metas[0].indices).to.eql(['time-testing-4']);
          done();
        }).catch(done);

        setTimeout(function () {
          $httpBackend.flush();
        }, 500);
      });

      it('dashboard exist and it has savedSearch and index exists the results were pruned', function (done) {

        $httpBackend.whenPOST('/elasticsearch/_msearch?getCountsOnTabs').respond(200, {
          responses: [
            {
              coordinate_search: {
                actions: [
                  {
                    is_pruned: true
                  }
                ]
              },
              hits: {
                total: 42
              }
            }
          ]
        });

        dashboardGroupHelper.getDashboardsMetadata(['time-testing-4']).then(function (metas) {
          expect(metas.length).to.equal(1);
          expect(metas[0].count).to.equal(42);
          expect(metas[0].isPruned).to.equal(true);
          expect(metas[0].dashboardId).to.equal('time-testing-4');
          expect(metas[0].indices).to.eql(['time-testing-4']);
          done();
        }).catch(done);

        setTimeout(function () {
          $httpBackend.flush();
        }, 500);
      });

      it('dashboard exist and it has savedSearch and index exists but is not accessible', function (done) {

        const authError = new Error();
        authError.status = 403;

        sinon.stub(kibiState, 'timeBasedIndices').returns(Promise.reject(authError));

        $httpBackend.whenPOST('/elasticsearch/_msearch?getCountsOnTabs').respond(200, {
          responses: [{
            hits: {
              total: 0
            }
          }]
        });

        dashboardGroupHelper.getDashboardsMetadata(['time-testing-4']).then(function (metas) {
          expect(metas.length).to.equal(1);
          expect(metas[0].count).to.equal('Forbidden');
          expect(metas[0].forbidden).to.be(true);
          expect(metas[0].dashboardId).to.equal('time-testing-4');
          expect(metas[0].indices).to.eql([]);
          done();
        }).catch(done);

        setTimeout(function () {
          $httpBackend.flush();
        }, 500);
      });

      it('dashboard exist and it has savedSearch and index exists but a non auth error occurs when resolving indices', function (done) {

        sinon.stub(kibiState, 'timeBasedIndices').returns(Promise.reject(new Error()));

        dashboardGroupHelper.getDashboardsMetadata(['time-testing-4'])
        .then(() => done(new Error('timeBasedIndices error was not rethrown.')))
        .catch(() => done());
      });
    });
  });
});
