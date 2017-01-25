import _ from 'lodash';
import angular from 'angular';
import chrome from 'ui/chrome';
import 'ui/courier';
import 'ui/config';
import 'ui/notify';
import 'ui/typeahead';
import 'ui/share';
import 'plugins/kibana/dashboard/directives/grid';
import 'plugins/kibana/dashboard/directives/dashboard_panel';
import 'plugins/kibana/dashboard/services/saved_dashboards';
import 'plugins/kibana/dashboard/styles/main.less';
import FilterBarQueryFilterProvider from 'ui/filter_bar/query_filter';
import DocTitleProvider from 'ui/doc_title';
import stateMonitorFactory  from 'ui/state_management/state_monitor_factory';
import uiRoutes from 'ui/routes';
import uiModules from 'ui/modules';
import indexTemplate from 'plugins/kibana/dashboard/index.html';
import { savedDashboardRegister } from 'plugins/kibana/dashboard/services/saved_dashboard_register';
import { createPanelState } from 'plugins/kibana/dashboard/components/panel/lib/panel_state';
require('ui/saved_objects/saved_object_registry').register(savedDashboardRegister);

// kibi: added as it is needed by src/plugins/kibana/public/dashboard/partials/save_dashboard.html
import 'ui/kibi/directives/kibi_select';
// kibi: end

const app = uiModules.get('app/dashboard', [
  'elasticsearch',
  'ngRoute',
  'kibana/courier',
  'kibana/config',
  'kibana/notify',
  'kibana/typeahead'
]);

uiRoutes
.defaults(/dashboard/, {
  requireDefaultIndex: true
})
.when('/dashboard', {
  template: indexTemplate,
  resolve: {
    dash: function (createNotifier, Promise, savedDashboards, kibiDefaultDashboardTitle, kbnUrl) {
      // kibi:
      // - get all the dashboards
      // - if none, just create a new one
      // - if any try to load the default dashboard if set, otherwise load the first dashboard
      // - if the default dashboard is missing, load the first dashboard
      // - if the first dashboard is missing, create a new one
      let getDefaultDashboard = Promise.resolve({ hits: [] });
      const notify = createNotifier();

      if (kibiDefaultDashboardTitle) {
        getDefaultDashboard = savedDashboards.find(kibiDefaultDashboardTitle, 1);
      }
      return Promise.all([
        savedDashboards.find('', 1),
        getDefaultDashboard
      ])
      .then(([
              { total: totalFirst, hits: [ firstDashboard ] },
              { total: totalDefault, hits: [ defaultDashboard ] }
            ]) => {
        if (!totalFirst) {
          return savedDashboards.get();
        }
        // kibi: select the first dashboard if default_dashboard_title is not set or does not exist
        let dashboardId = firstDashboard.id;
        if (totalDefault === 0) {
          notify.error(`The default dashboard with title "${kibiDefaultDashboardTitle}" does not exist.
            Please correct the "kibi_core.default_dashboard_title" parameter in kibi.yml`);
        } else if (totalDefault > 0) {
          dashboardId = defaultDashboard.id;
        }
        kbnUrl.redirect(`/dashboard/${dashboardId}`);
        return Promise.halt();
      });
    }
  }
})
.when('/dashboard/:id', {
  template: indexTemplate,
  resolve: {
    dash: function (savedDashboards, $route, courier) {
      return savedDashboards.get($route.current.params.id)
      .catch(courier.redirectWhenMissing({
        dashboard : '/dashboard/new-dashboard/create/'
      }));
    }
  }
})
// kibi: this path is used to show an empty dashboard when creating a new one
.when('/dashboard/new-dashboard/create/', {
  template: indexTemplate,
  resolve: {
    dash: function (savedDashboards) {
      return savedDashboards.get();
    }
  }
});

app.directive('dashboardApp', function (createNotifier, courier, AppState, timefilter, kbnUrl) {
  return {
    restrict: 'E',
    controllerAs: 'dashboardApp',
    controller: function (kibiState, globalState, config, $scope, $rootScope, $route, $routeParams, $location, Private, getAppState) {

      const queryFilter = Private(FilterBarQueryFilterProvider);

      const notify = createNotifier({
        location: 'Dashboard'
      });

      const dash = $scope.dash = $route.current.locals.dash;

      const dashboardTime = kibiState._getDashboardProperty(dash.id, kibiState._properties.time);
      if (dashboardTime) {
        // kibi: time from the kibi state.
        // this allows to set a time (not save it with a dashboard), switch between dashboards, and
        // still retain the time set until the app is reloaded
        timefilter.time.mode = dashboardTime.m;
        timefilter.time.from = dashboardTime.f;
        timefilter.time.to = dashboardTime.t;
        if (dash.refreshInterval) {
          timefilter.refreshInterval = dash.refreshInterval;
        }
      } else if (dash.timeRestore && dash.timeTo && dash.timeFrom && !getAppState.previouslyStored()) {
        // time saved with the dashboard
        timefilter.time.mode = dash.timeMode;
        timefilter.time.to = dash.timeTo;
        timefilter.time.from = dash.timeFrom;
        if (dash.refreshInterval) {
          timefilter.refreshInterval = dash.refreshInterval;
        }
      } else {
        // default time
        const timeDefaults = config.get('timepicker:timeDefaults');
        timefilter.time.mode = timeDefaults.mode;
        timefilter.time.to = timeDefaults.to;
        timefilter.time.from = timeDefaults.from;
      }

      // kibi: below listener on globalState is needed to react when the global time is changed by the user
      // either directly in time widget or by clicking on histogram chart etc
      const saveWithChangesHandler = function (diff) {
        if (dash.id && diff.indexOf('time') !== -1 && timefilter.time.from && timefilter.time.to &&
            !kibiState._isDefaultTime(timefilter.time.mode, timefilter.time.from, timefilter.time.to)) {
          kibiState._saveTimeForDashboardId(dash.id, timefilter.time.mode, timefilter.time.from, timefilter.time.to);
          kibiState.save();
        }
      };
      globalState.on('save_with_changes', saveWithChangesHandler);

      // kibi: get the filters and query from the kibi state
      const dashboardQuery = kibiState._getDashboardProperty(dash.id, kibiState._properties.query);
      // do not take pinned filters !
      const dashboardFilters = kibiState._getDashboardProperty(dash.id, kibiState._properties.filters);

      const matchQueryFilter = function (filter) {
        return filter.query && filter.query.query_string && !filter.meta;
      };

      const extractQueryFromFilters = function (filters) {
        const filter = _.find(filters, matchQueryFilter);
        if (filter) return filter.query;
      };

      const stateDefaults = {
        id: dash.id, // kibi: added to identity a dashboard in helper methods
        title: dash.title,
        panels: dash.panelsJSON ? JSON.parse(dash.panelsJSON) : [],
        options: dash.optionsJSON ? JSON.parse(dash.optionsJSON) : {},
        uiState: dash.uiStateJSON ? JSON.parse(dash.uiStateJSON) : {},
        // kibi: get the query from the kibi state, and if unset get the one the searchsource
        query: dashboardQuery || extractQueryFromFilters(dash.searchSource.getOwn('filter')) || {query_string: {query: '*'}},
        // kibi: get the filters from the kibi state, and if unset get the one the searchsource
        filters: dashboardFilters || _.reject(dash.searchSource.getOwn('filter'), matchQueryFilter)
      };

      let stateMonitor;
      const $state = $scope.state = new AppState(stateDefaults);
      const $uiState = $scope.uiState = $state.makeStateful('uiState');
      const $appStatus = $scope.appStatus = this.appStatus = {};

      $scope.$watchCollection('state.options', function (newVal, oldVal) {
        if (!angular.equals(newVal, oldVal)) $state.save();
      });

      $scope.$watch('state.options.darkTheme', setDarkTheme);

      // kibi: removed open button
      $scope.topNavMenu = [{
        key: 'new',
        description: 'New Dashboard',
        run: function () {
          kbnUrl.change('/dashboard/new-dashboard/create/', {});
        },
        testId: 'dashboardNewButton',
      }, {
        key: 'add',
        description: 'Add a panel to the dashboard',
        template: require('plugins/kibana/dashboard/partials/pick_visualization.html'),
        testId: 'dashboardAddPanelButton',
      }, {
        key: 'save',
        description: 'Save Dashboard',
        template: require('plugins/kibana/dashboard/partials/save_dashboard.html'),
        testId: 'dashboardSaveButton',
      }, {
        key: 'share',
        description: 'Share Dashboard',
        template: require('plugins/kibana/dashboard/partials/share.html'),
        testId: 'dashboardShareButton',
      }, {
        key: 'options',
        description: 'Options',
        template: require('plugins/kibana/dashboard/partials/options.html'),
        testId: 'dashboardOptionsButton',
      }];

      $scope.refresh = _.bindKey(courier, 'fetch');

      timefilter.enabled = true;
      $scope.timefilter = timefilter;
      $scope.$listen(timefilter, 'fetch', $scope.refresh);

      courier.setRootSearchSource(dash.searchSource);

      const docTitle = Private(DocTitleProvider);

      function init() {
        updateQueryOnRootSource();

        if (dash.id) {
          docTitle.change(dash.title);
        }

        initPanelIndexes();

        // watch for state changes and update the appStatus.dirty value
        stateMonitor = stateMonitorFactory.create($state, stateDefaults);
        stateMonitor.onChange((status) => {
          $appStatus.dirty = status.dirty;
        });

        $scope.$on('$destroy', () => {
          // kibi: remove the listener on globalstate
          globalState.off('save_with_changes', saveWithChangesHandler);
          stateMonitor.destroy();
          dash.destroy();

          // Remove dark theme to keep it from affecting the appearance of other apps.
          setDarkTheme(false);
        });

        $scope.$emit('application.load');
      }

      function initPanelIndexes() {
        // find the largest panelIndex in all the panels
        let maxIndex = getMaxPanelIndex();

        // ensure that all panels have a panelIndex
        $scope.state.panels.forEach(function (panel) {
          if (!panel.panelIndex) {
            panel.panelIndex = maxIndex++;
          }
        });
      }

      function getMaxPanelIndex() {
        let maxId = $scope.state.panels.reduce(function (id, panel) {
          return Math.max(id, panel.panelIndex || id);
        }, 0);
        return ++maxId;
      }

      function updateQueryOnRootSource() {
        const filters = queryFilter.getFilters();
        if ($state.query) {
          dash.searchSource.set('filter', _.union(filters, [{
            query: $state.query
          }]));
        } else {
          dash.searchSource.set('filter', filters);
        }
      }

      function setDarkTheme(enabled) {
        const theme = Boolean(enabled) ? 'theme-dark' : 'theme-light';
        chrome.removeApplicationClass(['theme-dark', 'theme-light']);
        chrome.addApplicationClass(theme);
      }

      $scope.expandedPanel = null;
      $scope.hasExpandedPanel = () => $scope.expandedPanel !== null;
      $scope.toggleExpandPanel = (panelIndex) => {
        if ($scope.expandedPanel && $scope.expandedPanel.panelIndex === panelIndex) {
          $scope.expandedPanel = null;
        } else {
          $scope.expandedPanel =
            $scope.state.panels.find((panel) => panel.panelIndex === panelIndex);
        }
      };

      // update root source on kibiState reset
      $scope.$listen(kibiState, 'reset_app_state_query', function () {
        updateQueryOnRootSource();
        $state.save();
        $scope.refresh();
      });

      // update root source when filters update
      $scope.$listen(queryFilter, 'update', function () {
        updateQueryOnRootSource();
        $state.save();
      });

      // update data when filters fire fetch event
      $scope.$listen(queryFilter, 'fetch', $scope.refresh);

      $scope.newDashboard = function () {
        // kibi: changed from '/dashboard' because now there's a specific path for dashboard creation
        kbnUrl.change('/dashboard/new-dashboard/create', {});
      };

      $scope.filterResults = function () {
        updateQueryOnRootSource();
        $state.save();
        $scope.refresh();
      };

      $scope.save = function () {
        // kibi: lock the dashboard so kibi_state._getCurrentDashboardId ignore the change for a moment
        dash.locked = true;

        const previousDashId = dash.id;
        $state.save();

        const timeRestoreObj = _.pick(timefilter.refreshInterval, ['display', 'pause', 'section', 'value']);
        dash.panelsJSON = angular.toJson($state.panels);
        dash.uiStateJSON = angular.toJson($uiState.getChanges());
        // kibi: save the timepicker mode
        dash.timeMode = dash.timeRestore ? timefilter.time.mode : undefined;
        dash.timeFrom = dash.timeRestore ? timefilter.time.from : undefined;
        dash.timeTo = dash.timeRestore ? timefilter.time.to : undefined;
        dash.refreshInterval = dash.timeRestore ? timeRestoreObj : undefined;
        dash.optionsJSON = angular.toJson($state.options);

        dash.save()
        .then(function (id) {
          delete dash.locked; // kibi: our lock for the dashboard!
          stateMonitor.setInitialState($state.toJSON());
          $scope.kbnTopNav.close('save');
          if (id) {
            notify.info('Saved Dashboard as "' + dash.title + '"');
            $rootScope.$emit('kibi:dashboard:changed', id); // kibi: allow helpers to react to dashboard changes
            if (dash.id !== $routeParams.id) {
              kbnUrl.change('/dashboard/{{id}}', {id: dash.id});
            } else {
              docTitle.change(dash.lastSavedTitle);
            }
          }
        })
        .catch((err) => {
          // kibi: if the dashboard can't be saved rollback the dashboard id
          dash.id = previousDashId;
          delete dash.locked; // kibi: our lock for the dashboard!
          $scope.configTemplate.close('save');
          notify.error(err);
          // kibi: end
        });
      };

      let pendingVis = _.size($state.panels);
      $scope.$on('ready:vis', function () {
        if (pendingVis) pendingVis--;
        if (pendingVis === 0) {
          $state.save();
          $scope.refresh();
        }
      });

      // listen for notifications from the grid component that changes have
      // been made, rather than watching the panels deeply
      $scope.$on('change:vis', function () {
        $state.save();
      });

      // called by the saved-object-finder when a user clicks a vis
      $scope.addVis = function (hit) {
        pendingVis++;
        $state.panels.push(createPanelState(hit.id, 'visualization', getMaxPanelIndex()));
      };

      $scope.addSearch = function (hit) {
        pendingVis++;
        $state.panels.push(createPanelState(hit.id, 'search', getMaxPanelIndex()));
      };

      // Setup configurable values for config directive, after objects are initialized
      $scope.opts = {
        dashboard: dash,
        ui: $state.options,
        save: $scope.save,
        addVis: $scope.addVis,
        addSearch: $scope.addSearch,
        timefilter: $scope.timefilter
      };

      init();
    }
  };
});
