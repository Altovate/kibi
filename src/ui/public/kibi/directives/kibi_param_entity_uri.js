define(function (require) {

  require('ui/kibi/directives/kibi_param_entity_uri.less');
  require('ui/kibi/directives/kibi_select');

  var _ = require('lodash');
  var chrome = require('ui/chrome');

  require('ui/modules').get('kibana')
    .directive('kibiParamEntityUri', function ($http, Private, createNotifier) {

      var indexPath = Private(require('ui/kibi/components/commons/_index_path'));

      var notify = createNotifier({
        location: 'Selected Entity'
      });

      return {
        restrict: 'E',
        replace: true,
        scope: {
          entityUriHolder: '='
        },
        template: require('ui/kibi/directives/kibi_param_entity_uri.html'),
        link: function ($scope) {
          $scope.c = {
            indexPattern: null,
            index: null,
            type: null,
            id: null,
            column: null,
            extraIndexPatternItems: [],
            extraIdItems: []
          };

          $scope.$watch('entityUriHolder.entityURI', function () {
            if ($scope.entityUriHolder && $scope.entityUriHolder.entityURI) {
              var parts = $scope.entityUriHolder.entityURI.split('/');
              if (!$scope.c.indexPattern) {
                $scope.c.indexPattern = parts[0];
              } else {
                $scope.c.extraIndexPatternItems = [];
              }
              $scope.c.extraIndexPatternItems = [{
                label: parts[0],
                value: parts[0]
              }];
              $scope.c.index = parts[0];
              $scope.c.type = parts[1];
              $scope.c.id = parts[2];
              if (parts.length > 3) {
                $scope.c.column = parts[3];
              }
              if ($scope.c.id) {
                $scope.c.extraIdItems = [{
                  label: $scope.c.id,
                  value: $scope.c.id
                }];
              }
            } else {
              $scope.c.indexPattern = null;
            }
          }, true);

          $scope.$watchMulti(['c.indexPattern', 'c.type', 'c.id'], function (newV, oldV) {
            var diff = _.difference(newV, oldV);
            if (diff.length !== 3) {
              if (oldV[0] !== newV[0]) {
                $scope.c.index = $scope.c.indexPattern;
                $scope.c.type = null;
              }
              if (oldV[0] !== newV[0] || oldV[1] !== newV[1]) {
                $scope.c.id = null;
                $scope.c.column =  null;
                $scope.c.extraIdItems = [];
              }
            }

            if ($scope.c.index && $scope.c.type && $scope.c.id) {

              var path = indexPath($scope.c.index);

              if (path.indexOf('*') !== -1) {
                $http.get(chrome.getBasePath() + '/elasticsearch/' + path + '/' + $scope.c.type + '/_search?q=_id:' + $scope.c.id)
                .then(function (response) {
                  if (response.data.hits.total === 0) {
                    notify.warning('No documents found for the specified selection.');
                    $scope.entityUriHolder.entityURI = null;
                    return;
                  }
                  var hit = response.data.hits.hits[0];
                  if (response.data.hits.total > 1) {
                    notify.warning('Found more than one document for the specified selection, selected the first one.');
                  }
                  $scope.entityUriHolder.entityURI =
                    hit._index + '/' +
                    hit._type + '/' +
                    hit._id + '/' +
                    $scope.c.column;
                }).catch(function () {
                  notify.error('An error occurred while fetching the selected entity, please check if Elasticsearch is running.');
                  $scope.entityUriHolder.entityURI = null;
                });
              } else {
                $scope.entityUriHolder.entityURI =
                  $scope.c.index + '/' +
                  $scope.c.type + '/' +
                  $scope.c.id + '/' +
                  $scope.c.column;
              }
            }
          });

        }
      };
    });
});
