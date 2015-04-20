'use strict';

angular.module('myApp.home', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/home/:vcName', {
            templateUrl: 'home/home.html',
            controller: 'homeCtrl',
            resolve: {

                // set vc name as selected
                selectedVc: function ($route, virtualCollectionsService) {

                    var vcData = virtualCollectionsService.listUserVirtualCollectionData($route.current.params.vcName);
                    return vcData;
                },
                // do a listing
                pagingAwareCollectionListing: function ($route, collectionsService) {
                    var vcName = $route.current.params.vcName;

                    var path = $route.current.params.path;
                    if (path == null) {
                        path = "";
                    }

                    return collectionsService.listCollectionContents(vcName, path, 0);
                }

            }
        }).when('/home', {
      templateUrl: 'home/home.html',
      controller: 'homeCtrl',
      resolve: {
          // set vc name as selected
          selectedVc: function ($route) {

              return null;
          },
          // do a listing
          pagingAwareCollectionListing: function ($route, collectionsService) {
              return {};
          }

      }
  });
}])

.directive('onLastRepeat', function() {
        return function(scope, element, attrs) {
            if (scope.$last) setTimeout(function(){
                scope.$emit('onRepeatLast', element, attrs);
            }, 1);
        };
    })
    .controller('homeCtrl', ['$scope','$log', '$http', '$location', 'MessageService','globals','breadcrumbsService','virtualCollectionsService','collectionsService','fileService','selectedVc','pagingAwareCollectionListing',function ($scope, $log, $http, $location, MessageService, $globals, breadcrumbsService, $virtualCollectionsService, $collectionsService, fileService, selectedVc, pagingAwareCollectionListing) {

        /*
        basic scope data for collections and views
         */

        $scope.selectedVc = selectedVc;
        $scope.pagingAwareCollectionListing = pagingAwareCollectionListing.data;

        $scope.$on('onRepeatLast', function(scope, element, attrs){
                  $( "#selectable" ).selectable({
      stop: function() {
        $('.list_content').removeClass("ui-selected");
        var result = $( "#select-result" ).empty();
        $( ".ui-selected", this ).each(function() {
            var index = $( "#selectable li" ).index( this );
            result.append( " #" + ( index + 1 ) );
        });
      }
    });
              });

        /*
        Get a default list of the virtual collections that apply to the logged in user, for side nav
         */
        
        $scope.listVirtualCollections = function () {
            
            $log.info("getting virtual colls");

            return $http({method: 'GET', url: $globals.backendUrl('virtualCollection')}).success(function (data) {
                $scope.virtualCollections = data;
            }).error(function () {
                $scope.virtualCollections = [];
            });
        };
        /**
         * Handle the selection of a virtual collection from the virtual collection list, by causing a route change and updating the selected virtual collection
         * @param vcName
         */
        $scope.selectVirtualCollection = function (vcName,path) {

            $log.info("selectVirtualCollection()");
            if (!vcName) {
                MessageService.danger("missing vcName");
                return;
            }
            $log.info("list vc contents for vc name:" + vcName);
            $location.path("/home/" + vcName);
            $location.search("path", path);
        };
        /**
         * Get the breadcrumbs from the pagingAwareCollectionListing in the scope.  This updates the path
         * in the global scope breadcrmubsService.  I don't know if that's the best way, but gotta get it somehow.
         * Someday when I'm better at angualar we can do this differently.
         */
        $scope.getBreadcrumbPaths = function () {

            if (!$scope.pagingAwareCollectionListing) {
                return [];
            }

            breadcrumbsService.setCurrentAbsolutePath($scope.pagingAwareCollectionListing.pagingAwareCollectionListingDescriptor.parentAbsolutePath);
            return breadcrumbsService.getWholePathComponents();
        };

        /**
         * Upon the selection of an element in a breadrumb link, set that as the location of the browser, triggering
         * a view of that collection
         * @param index
         */
        $scope.goToBreadcrumb = function (index) {

            if (!index) {
                $log.error("cannot go to breadcrumb, no index");
                return;
            }

            $location.path("/home/root");
            $location.search("path", breadcrumbsService.buildPathUpToIndex(index));

        };
        var side_nav_toggled = "no";
        $scope.side_nav_toggle = function () {            
            if (side_nav_toggled == "no"){
                side_nav_toggled = "yes";
                $('.side_nav_options').animate({'opacity':'0'});
                $('#side_nav').animate({'width':'3%'});
                $('#main_contents').animate({'width':'96.9%'});
                $('.side_nav_toggle_button').text('>>');
            }else if(side_nav_toggled == "yes"){  
                side_nav_toggled = "no";      
                $('#main_contents').animate({'width':'81.9%'});
                $('#side_nav').animate({'width':'18%'});
                $('.side_nav_options').animate({'opacity':'1'});
                $('.side_nav_toggle_button').text('<<');
            }
        };
        /**
         * INIT
         */

        $scope.listVirtualCollections();



        

        /*
        Retrieve the data profile for the data object at the given absolute path
         */
        $scope.selectProfile = function(irodsAbsolutePath) {
            $log.info("going to Data Profile");
            if (!irodsAbsolutePath) {
                $log.error("missing irodsAbsolutePath")
                MessageService.danger("missing irodsAbsolutePath");
            }
            $location.path("/profile/" + irodsAbsolutePath);

        }


}])
    .factory('virtualCollectionsService', ['$http', '$log','globals', function ($http, $log, globals) {
        var virtualCollections = [];
        var virtualCollectionContents = [];
        var selectedVirtualCollection = {};

      return {


            listUserVirtualCollections: function () {
                $log.info("getting virtual colls");
                return $http({method: 'GET', url: globals.backendUrl('virtualCollection')}).success(function (data) {
                   virtualCollections = data;
                }).error(function () {
                   virtualCollections = [];
                });
            },

            listUserVirtualCollectionData: function (vcName) {
                $log.info("listing virtual collection data");

                if (!vcName) {
                    virtualCollectionContents = [];
                    return;
                }

                return $http({method: 'GET', url: globals.backendUrl('virtualCollection/') + vcName}).success(function (data) {
                    virtualCollections = data;
                }).error(function () {
                    virtualCollections = [];
                });

            }

        };


    }])
    .factory('collectionsService', ['$http', '$log', 'globals', function ($http, $log, $globals) {

        var pagingAwareCollectionListing = {};

        return {

            selectVirtualCollection : function(vcName) {
                //alert(vcName);
            },

            /**
             * List the contents of a collection, based on the type of virtual collection, and any subpath
             * @param reqVcName
             * @param reqParentPath
             * @param reqOffset
             * @returns {*|Error}
             */
            listCollectionContents: function (reqVcName, reqParentPath, reqOffset) {
                $log.info("doing get of the contents of a virtual collection");

                if (!reqVcName) {
                    $log.error("recVcName is missing");
                    throw "reqMcName is missing";
                }

                if (!reqParentPath) {
                    reqParentPath = "";
                }

                if (!reqOffset) {
                    reqOffset = 0;
                }

                $log.info("requesting vc:" + reqVcName + " and path:" + reqParentPath);
                return $http({method: 'GET', url: $globals.backendUrl('collection/') + reqVcName, params: {path: reqParentPath, offset: reqOffset }}).success(function (response) {
                    pagingAwareCollectionListing = response.data;

                }).error(function () {
                    pagingAwareCollectionListing = {};

                });

            },
            addNewCollection: function(parentPath, childName) {
                $log.info("addNewCollection()");
            }


        };


    }])
.factory('breadcrumbsService',  function ($rootScope, $log) {

        var bc = {};

        /**
         * Global representation of current file path for display
         */
        bc.currentAbsolutePath = null;
        bc.pathComponents = [];


        /**
         * Set the current iRODS path and split into components for use in breadcrumbs
         * @param pathIn
         */
        bc.setCurrentAbsolutePath = function (pathIn) {

            if (!pathIn) {
               this.clear();
                return;
            }

            this.currentAbsolutePath = pathIn;
            $log.info("path:" + pathIn);
            this.pathComponents = this.pathToArray(pathIn);
            $log.info("path components set:" + this.pathComponents);

        }

        /**
         * Turn a path into
         * @param pathIn
         * @returns {*}
         */
        bc.pathToArray = function(pathIn)  {
            if (!pathIn) {
                $log.info("no pathin");
                return [];
            }

            var array = pathIn.split("/");
            $log.info("array orig is:" + array);
            // first element may be blank because it's the root, so it'll be trimmed from the front

            if (array.length == 0) {
                return [];
            }

           array.shift();
            return array;

        }

        /**
         * given an index into the breadcrumbs, roll back and build an absolute path based on each element in the
         * bread crumbs array
         * @param index int wiht the index in the breadcrumbs that is the last part of the selected path
         * @returns {string}
         */
        bc.buildPathUpToIndex = function(index) {

            var path = this.getWholePathComponents();

            if (!path) {
                $log.error("no path components, cannot go to breadcrumb");
                throw("cannot build path");
            }

            var totalPath = "";

            for (var i = 0; i <= index; i++) {

                // skip a blank path, which indicates an element that is a '/' for root, avoid double slashes
                if (path[i]) {

                    totalPath = totalPath + "/" + path[i];
                }
            }

            $log.info("got total path:" + totalPath);
            return totalPath;


        }

        /**
         * Get all of the path components
         * @returns {*}
         */
        bc.getWholePathComponents = function() {

            if (!this.pathComponents) {
                return [];
            } else {
                return this.pathComponents;
            }

        }


        /**
         * Reset path data
         */
        bc.clear = function() {
            this.currentAbsolutePath = null;
            this.pathComponents = [];
        }

        return bc;

    })
;

