var jsvis = angular.module('jsvis', ['ngRoute'])
  .config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $routeProvider
      .when('/', {
        templateUrl: '../views/mainindex.html',
        controller: 'MainController'
      })
      .otherwise({
        redirectTo: '/'
      });
  })
  .controller('MainController', function($scope, ScopeService) {
    $scope.parseButton = function() {
      var code = $scope.editor.getValue();
      myInterpreter = new Interpreter(code, initAlert);
      disable('');
    };
    $scope.stepButton = function() {
      var node, start, end, ok;
      if (myInterpreter.stateStack[0]) {
        node = myInterpreter.stateStack[0].node;
        start = node.start;
        end = node.end;
      } else {
        start = 0;
        end = 0;
      }
      console.log('start: ' + start + ', end: ' + end);
      //createSelection(start, end);
      isCompleteStatement(start, end);
      try {
        ok = myInterpreter.step();
      } finally {
        if (!ok) {
          disable('disabled');
        }
      }
      ScopeService.updateScopeViz();
      $scope.treeArray = [ScopeService.masterTree];
    };
    $scope.biggerStepButton = function() {
      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var completeStatementBoolean = false;  //initialized to false to enter while loop
        var allCodeString = $scope.editor.getValue();
        while(completeStatementBoolean === false){
          node = myInterpreter.stateStack[0].node;
          start = node.start;
          end = node.end;
          completeStatementBoolean = isCompleteStatement(start, end);
          if(completeStatementBoolean){  //this if statement is for testing purposes
            console.log('Complete statement found!');
            console.log("  " + allCodeString.substring(start, end));
          }
          $scope.stepButton();
        }
      }
    }
    var initAlert = function(interpreter, scope) {
      var wrapper = function(text) {
        text = text ? text.toString() : '';
        return interpreter.createPrimitive(alert(text));
      };
      interpreter.setProperty(scope, 'alert',
          interpreter.createNativeFunction(wrapper));
    };
    var disable = function(disabled) {
      document.getElementById('stepButton').disabled = disabled;
      document.getElementById('biggerStepButton').disabled = disabled;
      document.getElementById('runButton').disabled = disabled;
    };
    /* 
    Highlights the text of current expression that is being evaluated:
    */
    function createSelection(start, end) {
      var field = document.getElementById('code');
      if (field.createTextRange) {
        var selRange = field.createTextRange();
        selRange.collapse(true);
        selRange.moveStart('character', start);
        selRange.moveEnd('character', end);
        selRange.select();
      } else if (field.setSelectionRange) {
        field.setSelectionRange(start, end);
      } else if (field.selectionStart) {
        field.selectionStart = start;
        field.selectionEnd = end;
      }
      field.focus();
      //console.log(isNewLine(field, start, end));
    }  //END createSelection
    /*
    Returns true if the node type is a complete statement
    (e.g. forStatement, variableStatement (includes a semicolon), expressionStatement (includes semicolor))
    */
    var isCompleteStatement = function(start, end){
      var str = $scope.editor.getValue();
      for(var i = end; i < str.length; i++){
        var char = str[i];
        if(!(/\s/.test(char)))  //character is NOT a white space
          return false;
        if(/\r|\n/.test(char)){  //new line found (good)
          break;
        }
      }
      for(var j = start - 1 ; j >= 0; j--){
        var char = str[j];
        if(!(/\s/.test(char)))
          return false;  //return false bc character is NOT a white space
        if(/\r|\n/.test(char)){
          break;
        }
      }
      //console.log(str.substring(start, end));
      return true;
    };  //END isCompleteStatement
    var removeSelfReferences = function(scope){
      for(var prop in scope){
        if(typeof scope[prop] === "object"){
          scope[prop] = "{}";
        }
      }
    };
    $scope.tree = [{name: "Global", variables: [], child: [ {name: "child1", variables: [], child: []}, {name: "child2", variables: [], child: []} ]}];
  })
  .service("ScopeService", function(){
    this._globalScope = {name: "Global", variables: [], child: [] };
    this.masterTree = null;

    var VizTree = function(jsiScope){
      this._scope = jsiScope;
      this.variables = Object.keys(jsiScope.properties);
      this._children = [];
      this._parent = null;
      if(jsiScope.parentScope !== null){
        this._parent = new VizTree(jsiScope.parentScope);
        this._parent._children.push(this);
      }
    };
    VizTree.prototype.findNode = function(jsiNode){
      if(jsiNode === this._scope){
        return this;
      }
      for (var i = 0; i < this._children.length; i++) {
        var foundNode = this._children[i].findNode(jsiNode);
        if( foundNode !== null){
          return foundNode;
        }
      }
      return false;
    };
    VizTree.prototype.addChild = function(vizNode){
      this._children.push(vizNode);
      vizNode._parent = this;
    };
    VizTree.prototype.merge = function(vizNode){
      var foundNode = this.findNode(vizNode._scope);
      if( foundNode === false){
        var parentNode = this.findNode(vizNode._parent._scope);
        parentNode.addChild(vizNode);
      }else if( vizNode._children[0] !== undefined ){
        this.merge(vizNode._children[0]);
      }
    };

    this.updateScopeViz = function(){
      var tempTrees = [];
      var scopeCount = 0;
      var stateStack = window.myInterpreter.stateStack;
      for (var i = 0; i < stateStack.length; i++) {
        if(stateStack[i].scope){
          var childNode = new VizTree(stateStack[i].scope);
          while(childNode._parent !== null){
            childNode = childNode._parent;
          }
          var rootNode = childNode;
          tempTrees.push(rootNode);
        }
      }
      this.masterTree = tempTrees[0];
      for (i = 1; i < tempTrees.length; i++) {
        this.masterTree.merge(tempTrees[i]);
      }
    };
  })
  .directive('aceEditor', function() {
    return {
      require: '?ngModel',
      link:link
    };
    function link(scope, element, attrs, ngModel) {
      scope.editor = ace.edit("editor");
      scope.editor.setTheme("ace/theme/monokai");
      scope.editor.getSession().setMode("ace/mode/javascript");
      scope.editor.setValue(scope.codeText);
    }
  });
