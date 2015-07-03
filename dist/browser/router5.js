/**
 * @license
 * The MIT License (MIT)
 * 
 * Copyright (c) 2015 Thomas Roch
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function () {
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var rules = [{
    // An URL can contain a parameter :paramName
    // - and _ are allowed but not in last position
    name: 'url-parameter',
    pattern: /^:([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/,
    regex: /([a-zA-Z0-9-_.~]+)/
}, {
    // Url parameter (splat)
    name: 'url-parameter-splat',
    pattern: /^\*([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/,
    regex: /([^\?]*)/
}, {
    name: 'url-parameter-matrix',
    pattern: /^\;([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/,
    regex: function regex(match) {
        return new RegExp(';' + match[1] + '=([a-zA-Z0-9-_.~]+)');
    }
}, {
    // Query parameter: ?param1&param2
    //                   ?:param1&:param2
    name: 'query-parameter',
    pattern: /^(?:\?|&)(?:\:)?([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/
}, {
    // Delimiter /
    name: 'delimiter',
    pattern: /^(\/|\?)/,
    regex: function regex(match) {
        return new RegExp(match[0]);
    }
}, {
    // Sub delimiters
    name: 'sub-delimiter',
    pattern: /^(\!|\&|\-|_|\.|;)/,
    regex: function regex(match) {
        return new RegExp(match[0]);
    }
}, {
    // Unmatched fragment (until delimiter is found)
    name: 'fragment',
    pattern: /^([0-9a-zA-Z]+?)/,
    regex: function regex(match) {
        return new RegExp(match[0]);
    }
}];

var tokenise = function tokenise(str) {
    var tokens = arguments[1] === undefined ? [] : arguments[1];

    // Look for a matching rule
    var matched = rules.some(function (rule) {
        var match = str.match(rule.pattern);
        if (!match) return false;

        tokens.push({
            type: rule.name,
            match: match[0],
            val: match.length > 1 ? match.slice(1) : null,
            regex: rule.regex instanceof Function ? rule.regex(match) : rule.regex
        });

        if (match[0].length < str.length) tokens = tokenise(str.substr(match[0].length), tokens);
        return true;
    });
    // If no rules matched, throw an error (possible malformed path)
    if (!matched) {
        throw new Error('Could not parse path.');
    }
    // Return tokens
    return tokens;
};

var Path = (function () {
    function Path(path) {
        _classCallCheck(this, Path);

        if (!path) throw new Error('Please supply a path');
        this.path = path;
        this.tokens = tokenise(path);

        this.hasUrlParams = this.tokens.filter(function (t) {
            return /^url-parameter/.test(t.type);
        }).length > 0;
        this.hasSpatParam = this.tokens.filter(function (t) {
            return /splat$/.test(t.type);
        }).length > 0;
        this.hasMatrixParams = this.tokens.filter(function (t) {
            return /matrix$/.test(t.type);
        }).length > 0;
        this.hasQueryParams = this.tokens.filter(function (t) {
            return t.type === 'query-parameter';
        }).length > 0;
        // Extract named parameters from tokens
        this.urlParams = !this.hasUrlParams ? [] : this.tokens.filter(function (t) {
            return /^url-parameter/.test(t.type);
        }).map(function (t) {
            return t.val;
        })
        // Flatten
        .reduce(function (r, v) {
            return r.concat(v);
        });
        // Query params
        this.queryParams = !this.hasQueryParams ? [] : this.tokens.filter(function (t) {
            return t.type === 'query-parameter';
        }).map(function (t) {
            return t.val;
        })
        // Flatten
        .reduce(function (r, v) {
            return r.concat(v);
        });
        this.params = this.urlParams.concat(this.queryParams);
        // Check if hasQueryParams
        // Regular expressions for url part only (full and partial match)
        this.source = this.tokens.filter(function (t) {
            return t.regex !== undefined;
        }).map(function (r) {
            return r.regex.source;
        }).join('');
    }

    _createClass(Path, [{
        key: '_urlMatch',
        value: function _urlMatch(path, regex) {
            var _this = this;

            var match = path.match(regex);
            if (!match) return null;else if (!this.urlParams.length) return {};
            // Reduce named params to key-value pairs
            return match.slice(1, this.urlParams.length + 1).reduce(function (params, m, i) {
                params[_this.urlParams[i]] = m;
                return params;
            }, {});
        }
    }, {
        key: 'match',
        value: function match(path) {
            var _this2 = this;

            // Check if exact match
            var match = this._urlMatch(path, new RegExp('^' + this.source + (this.hasQueryParams ? '?.*$' : '$')));
            // If no match, or no query params, no need to go further
            if (!match || !this.hasQueryParams) return match;
            // Extract query params
            var queryParams = path.split('?')[1].split('&').map(function (_) {
                return _.split('=');
            }).reduce(function (obj, m) {
                obj[m[0]] = m[1];
                return obj;
            }, {});

            if (Object.keys(queryParams).every(function (p) {
                return Object.keys(_this2.queryParams).indexOf(p) !== 1;
            }) && Object.keys(queryParams).length === this.queryParams.length) {
                // Extend url match
                Object.keys(queryParams).forEach(function (p) {
                    return match[p] = queryParams[p];
                });

                return match;
            }

            return null;
        }
    }, {
        key: 'partialMatch',
        value: function partialMatch(path) {
            // Check if partial match (start of given path matches regex)
            return this._urlMatch(path, new RegExp('^' + this.source));
        }
    }, {
        key: 'build',
        value: function build() {
            var params = arguments[0] === undefined ? {} : arguments[0];

            // Check all params are provided (not search parameters which are optional)
            if (!this.params.every(function (p) {
                return params[p] !== undefined;
            })) throw new Error('Missing parameters');

            var base = this.tokens.filter(function (t) {
                return t.type !== 'query-parameter';
            }).map(function (t) {
                if (t.type === 'url-parameter-matrix') return ';' + t.val[0] + '=' + params[t.val[0]];
                return /^url-parameter/.test(t.type) ? params[t.val[0]] : t.match;
            }).join('');

            var searchPart = this.queryParams.map(function (p) {
                return p + '=' + params[p];
            }).join('&');

            return base + (searchPart ? '?' + searchPart : '');
        }
    }]);

    return Path;
})();

// regex:   match => new RegExp('(?=(\?|.*&)' + match[0] + '(?=(\=|&|$)))')
var RouteNode = (function () {
    function RouteNode() {
        var name = arguments[0] === undefined ? '' : arguments[0];
        var path = arguments[1] === undefined ? '' : arguments[1];
        var childRoutes = arguments[2] === undefined ? [] : arguments[2];

        _classCallCheck(this, RouteNode);

        this.name = name;
        this.path = path;
        this.parser = path ? new Path(path) : null;
        this.children = [];

        this.add(childRoutes);

        return this;
    }

    _createClass(RouteNode, [{
        key: 'add',
        value: function add(route) {
            var _this = this;

            if (route instanceof Array) {
                route.forEach(function (r) {
                    return _this.add(r);
                });
                return;
            }

            if (!(route instanceof RouteNode) && !(route instanceof Object)) {
                throw new Error('Route constructor expects routes to be an Object or an instance of Route.');
            }
            if (route instanceof Object) {
                if (!route.name || !route.path) {
                    throw new Error('Route constructor expects routes to have an name and a path defined.');
                }
                route = new RouteNode(route.name, route.path, route.children);
            }
            // Check duplicated routes
            if (this.children.map(function (child) {
                return child.name;
            }).indexOf(route.name) !== -1) {
                throw new Error('Alias "' + route.name + '" is already defined in route node');
            }
            // Check duplicated paths
            if (this.children.map(function (child) {
                return child.path;
            }).indexOf(route.path) !== -1) {
                throw new Error('Path "' + route.path + '" is already defined in route node');
            }

            var names = route.name.split('.');

            if (names.length === 1) {
                this.children.push(route);
                // Push greedy splats to the bottom of the pile
                this.children.sort(function (childA, childB) {
                    return childA.hasSplatParam ? -1 : 1;
                });
            } else {
                // Locate parent node
                var segments = this.getSegmentsByName(names.slice(0, -1).join('.'));
                if (segments) {
                    segments[segments.length - 1].add(new RouteNode(names[names.length - 1], route.path, route.children));
                } else {
                    throw new Error('Could not add route named \'' + route.name + '\', parent is missing.');
                }
            }

            return this;
        }
    }, {
        key: 'addNode',
        value: function addNode(name, params) {
            this.add(new RouteNode(name, params));
            return this;
        }
    }, {
        key: 'getSegmentsByName',
        value: function getSegmentsByName(routeName) {
            var findSegmentByName = function findSegmentByName(name, routes) {
                var filteredRoutes = routes.filter(function (r) {
                    return r.name === name;
                });
                return filteredRoutes.length ? filteredRoutes[0] : undefined;
            };
            var segments = [];
            var names = routeName.split('.');
            var routes = this.children;

            var matched = names.every(function (name) {
                var segment = findSegmentByName(name, routes);
                if (segment) {
                    routes = segment.children;
                    segments.push(segment);
                    return true;
                }
                return false;
            });

            return matched ? segments : null;
        }
    }, {
        key: 'getSegmentsMatchingPath',
        value: function getSegmentsMatchingPath(path) {
            var matchChildren = function matchChildren(nodes, pathSegment, segments) {
                var _loop = function (i) {
                    var child = nodes[i];
                    // Partially match path
                    var match = child.parser.partialMatch(pathSegment);
                    if (match) {
                        segments.push(child);
                        Object.keys(match).forEach(function (param) {
                            return segments.params[param] = match[param];
                        });
                        // Remove consumed segment from path
                        var remainingPath = pathSegment.replace(child.parser.build(match), '');
                        // If fully matched
                        if (!remainingPath.length) {
                            return {
                                v: segments
                            };
                        }
                        // If no children to match against but unmatched path left
                        if (!child.children.length) {
                            return {
                                v: null
                            };
                        }
                        // Else: remaining path and children
                        return {
                            v: matchChildren(child.children, remainingPath, segments)
                        };
                    }
                };

                // for (child of node.children) {
                for (var i in nodes) {
                    var _ret = _loop(i);

                    if (typeof _ret === 'object') return _ret.v;
                }
                return null;
            };

            var startingNodes = this.parser ? [this] : this.children;
            var segments = [];
            segments.params = {};

            return matchChildren(startingNodes, path, segments);
        }
    }, {
        key: 'getPathFromSegments',
        value: function getPathFromSegments(segments) {
            return segments ? segments.map(function (segment) {
                return segment.path;
            }).join('') : null;
        }
    }, {
        key: 'getPath',
        value: function getPath(routeName) {
            return this.getPathFromSegments(this.getSegmentsByName(routeName));
        }
    }, {
        key: 'buildPathFromSegments',
        value: function buildPathFromSegments(segments) {
            var params = arguments[1] === undefined ? {} : arguments[1];

            return segments ? segments.map(function (segment) {
                return segment.parser.build(params);
            }).join('') : null;
        }
    }, {
        key: 'buildPath',
        value: function buildPath(routeName) {
            var params = arguments[1] === undefined ? {} : arguments[1];

            return this.buildPathFromSegments(this.getSegmentsByName(routeName), params);
        }
    }, {
        key: 'getMatchPathFromSegments',
        value: function getMatchPathFromSegments(segments) {
            if (!segments) return null;

            var name = segments.map(function (segment) {
                return segment.name;
            }).join('.');
            var params = segments.params;

            return { name: name, params: params };
        }
    }, {
        key: 'matchPath',
        value: function matchPath(path) {
            return this.getMatchPathFromSegments(this.getSegmentsMatchingPath(path));
        }
    }]);

    return RouteNode;
})();'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var nameToIDs = function nameToIDs(name) {
    return name.split('.').reduce(function (ids, name) {
        ids.push(ids.length ? ids[ids.length - 1] + '.' + name : name);
        return ids;
    }, []);
};

var makeState = function makeState(name, params, path) {
    return { name: name, params: params, path: path };
};

var Router5 = (function () {
    function Router5(routes) {
        var opts = arguments[1] === undefined ? {} : arguments[1];

        _classCallCheck(this, Router5);

        this.started = false;
        this.callbacks = {};
        this.lastStateAttempt = null;
        this.lastKnownState = null;
        this.rootNode = routes instanceof RouteNode ? routes : new RouteNode('', '', routes);
        this.activeComponents = {};
        this.options = opts;

        return this;
    }

    _createClass(Router5, [{
        key: 'setOption',
        value: function setOption(opt, val) {
            this.options[opt] = val;
            return this;
        }
    }, {
        key: 'add',
        value: function add(routes) {
            this.rootNode.add(routes);
            return this;
        }
    }, {
        key: 'addNode',
        value: function addNode(name, params) {
            this.rootNode.addNode(name, params);
            return this;
        }
    }, {
        key: 'onPopState',
        value: function onPopState(evt) {
            // Do nothing if no state or if last know state is poped state (it should never happen)
            var state = evt.state || this.matchPath(this.getWindowPath());
            if (!state) return;
            if (this.lastKnownState && this.areStatesEqual(state, this.lastKnownState)) return;

            var canTransition = this._transition(state, this.lastKnownState);
        }
    }, {
        key: 'start',
        value: function start() {
            if (this.started) return this;
            this.started = true;

            // Try to match starting path name
            var startPath = this.getWindowPath();
            var startState = this.matchPath(startPath);

            if (startState) {
                this.lastKnownState = startState;
                window.history.replaceState(this.lastKnownState, '', this.options.useHash ? '#' + startPath : startPath);
            } else if (this.options.defaultRoute) {
                this.navigate(this.options.defaultRoute, this.options.defaultParams, { replace: true });
            }
            // Listen to popstate
            window.addEventListener('popstate', this.onPopState.bind(this));
            return this;
        }
    }, {
        key: 'stop',
        value: function stop() {
            if (!this.started) return this;
            this.started = false;

            window.removeEventListener('popstate', this.onPopState.bind(this));
            return this;
        }
    }, {
        key: '_invokeCallbacks',
        value: function _invokeCallbacks(name, newState, oldState) {
            var _this = this;

            if (!this.callbacks[name]) return;
            this.callbacks[name].forEach(function (cb) {
                cb.call(_this, newState, oldState);
            });
        }
    }, {
        key: '_transition',
        value: function _transition(toState, fromState) {
            var _this2 = this;

            if (!fromState) {
                this.lastKnownState = toState;
                this._invokeCallbacks('', toState, fromState);
                return true;
            }

            var i = undefined;
            var cannotDeactivate = false;
            var fromStateIds = nameToIDs(fromState.name);
            var toStateIds = nameToIDs(toState.name);
            var maxI = Math.min(fromStateIds.length, toStateIds.length);

            for (i = 0; i < maxI; i += 1) {
                if (fromStateIds[i] !== toStateIds[i]) break;
            }

            cannotDeactivate = fromStateIds.slice(i).reverse().map(function (id) {
                return _this2.activeComponents[id];
            }).filter(function (comp) {
                return comp && comp.canDeactivate;
            }).some(function (comp) {
                return !comp.canDeactivate(toState, fromState);
            });

            if (!cannotDeactivate) {
                this.lastKnownState = toState;
                if (i > 0) this._invokeCallbacks(fromStateIds[i - 1], toState, fromState);
                this._invokeCallbacks('', toState, fromState);
            }

            return !cannotDeactivate;
        }
    }, {
        key: 'getState',
        value: function getState() {
            return this.lastKnownState
            // return window.history.state
            ;
        }
    }, {
        key: 'getWindowPath',
        value: function getWindowPath() {
            return this.options.useHash ? window.location.hash.replace(/^#/, '') : window.location.pathname;
        }
    }, {
        key: 'areStatesEqual',
        value: function areStatesEqual(state1, state2) {
            return state1.name === state2.name && Object.keys(state1.params).length === Object.keys(state2.params).length && Object.keys(state1.params).every(function (p) {
                return state1.params[p] === state2.params[p];
            });
        }
    }, {
        key: 'registerComponent',
        value: function registerComponent(name, component) {
            if (this.activeComponents[name]) console.warn('A component was alread registered for route node ' + name + '.');
            this.activeComponents[name] = component;
        }
    }, {
        key: 'deregisterComponent',
        value: function deregisterComponent(name) {
            delete this.activeComponents[name];
        }
    }, {
        key: 'addNodeListener',
        value: function addNodeListener(name, cb) {
            if (name) {
                var segments = this.rootNode.getSegmentsByName(name);
                if (!segments) console.warn('No route found for ' + name + ', listener could be never called!');
            }
            if (!this.callbacks[name]) this.callbacks[name] = [];
            this.callbacks[name].push(cb);
        }
    }, {
        key: 'removeNodeListener',
        value: function removeNodeListener(name, cb) {
            if (!this.callbacks[name]) return;
            this.callbacks[name] = this.callbacks[name].filter(function (callback) {
                return callback !== cb;
            });
        }
    }, {
        key: 'addListener',
        value: function addListener(cb) {
            this.addNodeListener('', cb);
        }
    }, {
        key: 'removeListener',
        value: function removeListener(cb) {
            this.removeNodeListener('', cb);
        }
    }, {
        key: 'buildPath',
        value: function buildPath(route, params) {
            return (this.options.useHash ? '#' : '') + this.rootNode.buildPath(route, params);
        }
    }, {
        key: 'matchPath',
        value: function matchPath(path) {
            var match = this.rootNode.matchPath(path);
            return match ? makeState(match.name, match.params, path) : null;
        }
    }, {
        key: 'navigate',
        value: function navigate(name) {
            var params = arguments[1] === undefined ? {} : arguments[1];
            var opts = arguments[2] === undefined ? {} : arguments[2];

            if (!this.started) return;

            var path = this.rootNode.buildPath(name, params);

            if (!path) throw new Error('Could not find route "' + name + '"');

            this.lastStateAttempt = makeState(name, params, path);
            var sameStates = this.lastKnownState ? this.areStatesEqual(this.lastKnownState, this.lastStateAttempt) : false;

            // Do not proceed further if states are the same and no reload
            // (no desactivation and no callbacks)
            if (sameStates && !opts.reload) return;

            // Transition and amend history
            var canTransition = this._transition(this.lastStateAttempt, this.lastKnownState);

            if (canTransition && !sameStates) {
                window.history[opts.replace ? 'replaceState' : 'pushState'](this.lastStateAttempt, '', this.options.useHash ? '#' + path : path);
            }
        }
    }]);

    return Router5;
})();

window.RouteNode = RouteNode;
window.Router5 = Router5;

}());