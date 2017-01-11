import FilterManagerProvider from 'ui/filter_manager';
import onPage from 'ui/kibi/utils/on_page';
import _ from 'lodash';
import 'ui/kibi/directives/kibi_param_entity_uri';
import 'ui/kibi/kibi_doc_table/kibi_doc_table';
import uiModules from 'ui/modules';

uiModules
.get('kibana/kibi_data_table_vis', ['kibana'])
.controller('KibiDataTableVisController', function ($rootScope, $scope, Private) {
  const filterManager = Private(FilterManagerProvider);
  const configMode = onPage.onVisualizePage();

  $scope.queryColumn = {};
  $scope.cellClickHandlers = {};
  $scope.savedObj = {
    columns: $scope.vis.params.columns,
    sort: $scope.vis.params.sort
  };

  // NOTE: filter to enable little icons in doc-viewer to filter and add/remove columns
  $scope.filter = function (field, value, operator) {
    //here grab the index
    const index = $scope.searchSource.get('index').id;
    filterManager.add(field, value, operator, index);
  };

  const _constructCellOnClicksObject = function () {
    $scope.cellClickHandlers = {};
    _.each($scope.vis.params.clickOptions, function (clickHandler) {
      if (!$scope.cellClickHandlers[clickHandler.columnField]) {
        $scope.cellClickHandlers[clickHandler.columnField] = [];
      }
      $scope.cellClickHandlers[clickHandler.columnField].push(clickHandler);
    });
  };
  _constructCellOnClicksObject();

  const _constructQueryColumnObject = function () {
    if ($scope.vis.params.enableQueryFields === true && $scope.vis.params.queryFieldName) {
      $scope.queryColumn = {
        name: $scope.vis.params.queryFieldName,
        queryDefinitions: $scope.vis.params.queryDefinitions,
        joinElasticsearchField: $scope.vis.params.joinElasticsearchField
      };
    } else {
      $scope.queryColumn = {};
    }
  };
  _constructQueryColumnObject();

  // when autoupdate is on we detect the refresh here for template visualization
  $scope.$watch('esResponse', function (resp) {
    if (resp && $scope.searchSource) {
      $scope.searchSource.fetchQueued();
    }
  });

  if (configMode) {
    const removeVisStateChangedHandler = $rootScope.$on('kibi:vis:state-changed', function () {
      _constructQueryColumnObject();
      _constructCellOnClicksObject();
      $scope.searchSource.fetchQueued();
    });

    const removeVisColumnsChangedHandler = $rootScope.$on('kibi:vis:columns-changed', function (event, columns) {
      if (columns) {
        $scope.savedObj.columns = columns;
      }
    }, true);

    $scope.$on('$destroy', function () {
      removeVisStateChangedHandler();
      removeVisColumnsChangedHandler();
    });

    $scope.$watch('savedObj.columns', function () {
      $rootScope.$emit('kibi:vis:savedObjectColumns-changed', $scope.savedObj);
    });
  }

});
