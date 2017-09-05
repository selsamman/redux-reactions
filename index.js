var connect = require('react-redux').connect;
var ReactionsTemplate = {
    actions: {},
    actionsGroup: {},
    selectorsGroup: {},
    actionsStateMap: {},
    groupStateMap: {},
    reducerTree: {},
    addReactions: addReactions,
    reduce: topLevelReducer,
    connect: reactionsConnect,
    bindActionCreators : bindActionCreatorsDeferred,
    stateChanges: stateChanges,
    clear: clear
}
var Reactions = Object.assign({}, ReactionsTemplate);
export default Reactions;

function clear () {
    return Object.assign(Reactions, ReactionsTemplate);
}
function reactionsConnect(group, mapStateToProps, mapDispatchToProps, mergeProps, options) {

    function mapStateSliceToProps (state, props) {
        var mappedState = mapStateMap(state, Reactions.groupStateMap[group]);
        var stateSlice = {};
        for (var prop in Reactions.selectorsGroup[group])
            stateSlice[prop] = Reactions.selectorsGroup[group][prop](mappedState);

        if (mapStateToProps)
            Object.assign(stateSlice, mapStateToProps(mappedState, props));

        return stateSlice;
    };

    function mapDispatchBoundToProps (dispatch, ownProps) {
        var boundActions = bindActionCreatorsDeferred(Reactions.actionsGroup[group], dispatch);
        if (mapDispatchToProps)
            Object.assign(boundActions, typeof mapDispatchToProps == 'function' ?
                mapDispatchToProps(ownProps, Reactions.actionsGroup[group]) :
                bindActionCreatorsDeferred(mapDispatchToProps));
        return boundActions;
    }

    return connect(mapStateSliceToProps, mapDispatchBoundToProps, mergeProps || mergePropsAndBindActionCreators, options);

    function mergePropsAndBindActionCreators(stateProps, dispatchProps, ownProps) {
        var props = {}
        var boundDispatchProps = {};
        for (var name in dispatchProps) {
            var prop = dispatchProps[name];
            boundDispatchProps[name] = typeof prop === 'function' ? dispatchProps[name].bind(null, props) : prop;
        }
        Object.assign(props, stateProps, boundDispatchProps, ownProps);
        return props;
    }
}
function bindActionCreatorsDeferred(actions, dispatch) {
    var dispatches = {}
    for (var actionName in actions) {
        (function () {
            var closureAction = actionName;
            dispatches[actionName] =  function () {
                var props = arguments[0];
                var args = Array.prototype.slice.call(arguments, 1);
                return dispatch(thunk);
                function thunk(dispatch, getState) {
                    var actionResult = actions[closureAction].apply(null, args); // reactions thunk or action object
                    if (typeof actionResult == 'function') // Reactions thunk
                        return actionResult.apply(null, [props, dispatch, getState]); // Invoke our thunk
                    else
                        dispatch(actionResult);
                }
            }
        })()
    }
    return dispatches;
}

function addReactions (newReactions, substitutions, group) {
    if (newReactions instanceof Array)
        return newReactions.map((reactions) => addReactions(reactions, substitutions, group));
    for (var name in newReactions) {
        var reactionOrSelector = newReactions[name];
        if (typeof reactionOrSelector === 'function')
            prepareSelector(reactionOrSelector, name, substitutions, group);
        else
            prepareReaction(reactionOrSelector, name, substitutions, group);
    }
    //console.log(JSON.stringify(Reactions));
}

// This reducer will wall through all the states while simaltaniously traversing a tree of reaction declarations
// At each node it will either pass through the state or process it.  When processed the reaction level reducer is
// called and can return a new state.  For processed states, the traversal is continued.   Logic ensures that when
// delcarations include variable instances even at multiple levels that the correct reducers are executed that match
// after resolving these variable instances

function topLevelReducer(rootState, action) {

    var reactions = Reactions.reducerTree[action.type];
    if (!reactions)
        return rootState;

    // Process each high level state property
    var accumulator = {reactions: reactions.children, oldState: rootState, newState: {}};
    return Object.getOwnPropertyNames(rootState).reduce(reducer, accumulator).newState;

    // Process state node (arrays normalized to return indes in value parameter)
    function reducer(accumulator, propOrIndex) {

        var oldState = accumulator.oldState[propOrIndex];
        var newState = oldState;

        // Determine whether this node is to be processed or bypassed
        var processChildNodes = false;
        var children = {};
        for (var childReactionNode in accumulator.reactions || {}) {
            var reactionNode = accumulator.reactions[childReactionNode];

            if (evaluate(childReactionNode, reactionNode, newState, propOrIndex)) {

                if (reactionNode.reducers) {
                    reactionNode.reducers.map(function (reducer) {
                        newState = execute(reducer, newState);
                    });
                }

                if (reactionNode.children) {
                    processChildNodes |= true;
                    Object.assign(children, reactionNode.children);
                }

            }
        }
        // If we have a reaction defined for this slice of the hierarchy we must copy state
        if (processChildNodes) {
            var subAccumulator = newState instanceof Array ?
                oldState.reduce(arrayReducer, {oldState: newState, newState: [], reactions: children}) :
                Object.getOwnPropertyNames(oldState).reduce(reducer, {oldState: newState, newState: {}, reactions: children})
            // Trim nulls and undefined values out of arrays if needed
            if (subAccumulator.filterArray)
                newState = subAccumulator.newState.filter(function (item) {return item != null & typeof item != 'undefined'});
            else
                newState = subAccumulator.newState;
        }

        // For array elements that result in undefined we want to alert the top level that a filter may be necessary
        if (accumulator.oldState instanceof Array && typeof newState == 'undefined' || newState == null)
            accumulator.filterArray = true;

        // If we have reducers for this slice we pass the old state to the reducers one at a time
        // and expect them to return a new state for this slice of the tree
        accumulator.newState[propOrIndex] = newState;

        return accumulator
    }
    // Normalize object and a array reduction so we allways have and index into the state being copied
    function arrayReducer(accumulator, currentValue, currentIndex) {
        return reducer(accumulator, currentIndex);
    }
    // Execute the reducer function
    function execute(reducer, newState) {
        if (reducer.set) {
            return reducer.set.call(null, action, mapState(rootState), newState);
        } else if (reducer.append) {
            return newState.concat(reducer.append.call(null, action, mapState(rootState), newState));
        } else if (reducer.insert) {
            const insertResult = reducer.insert.call(null, action, mapState(rootState), newState);
            const shallowCopy = newState.slice();
            shallowCopy.splice(insertResult[0], 0, insertResult[1]);
            return shallowCopy;
        } else if (reducer.assign) {
            return Object.assign({}, newState, reducer.assign.call(null, action, mapState(rootState), newState));
        } else if (reducer.delete) {
            return undefined;
        } else {
            throw new Error('missing set, assign, append or delete on state for reaction: ' + action);
        }
    }
    // Find the value of a slice key in the format of [action|state.prop1.prop2 etc]
    function evaluate (reactionNodeKey, reactionNodeValue, element, propOrIndex) {
        if (typeof reactionNodeValue.evaluate == "function") {
            if (reactionNodeValue.evaluate.noMap)
                return reactionNodeValue.evaluate.call(null, rootState, element, propOrIndex);
            else
                return reactionNodeValue.evaluate.call(null, action, mapState(rootState), element, propOrIndex);
        } else
            return reactionNodeKey === propOrIndex;
    }
    /**
     * Substitute state map into top level state
     * @param topLevelState
     * @param stateMap
     * @param action
     */
    function mapState(rootState) {
        var stateMap = Reactions.actionsStateMap[action.type];
        return mapStateMap(rootState, stateMap);
    }

};

function mapStateMap(rootState, stateMap) {
    if (stateMap) {
        var newState = Object.assign({}, rootState);
        for (var stateProp in stateMap)
            if (newState[stateProp])
                newState[stateProp] = evaluateState(stateMap[stateProp])
        return newState;
    } else
        return rootState;

    function evaluateState(stateSlices) {
        var stateSlice = rootState
        stateSlices.map((sliceComponent) => {
            if (typeof sliceComponent == 'function') {
                if (stateSlice instanceof Array)
                    stateSlice = stateSlice.find((item, index) => sliceComponent.call(null, rootState, item, index));
                else {
                    var stateSliceProps = Object.getOwnPropertyNames(stateSlice);
                    var stateSliceProp = stateSliceProps.find((prop)=> sliceComponent.call(null, rootState, stateSlice[prop]))
                    stateSlice = stateSlice[stateSliceProp];
                }
            } else {
                stateSlice = stateSlice[sliceComponent];
            }
        });
        return stateSlice;
    }
}
function prepareSelector(selector, selectorName, substitutions, group) {

    if (group) {
        Reactions.selectorsGroup[group] =  Reactions.selectorsGroup[group] || {};
        Reactions.selectorsGroup[group][selectorName] = selector;
        Reactions.groupStateMap[group] = substitutions;
    }
}
/**
 * Produce a slice tree that encapsulates actions like ...
 *
 Reactions.stateMap = {
             todoList.AddTodo: {
                 reducers: [],
                 children: {
                     app: {
                        children: {
                            filter: {reducers: [Function] }]}
                        }
                     },
                     domain:{
                        children: {
                            todoList: {
                                reducers: [],
                                children: {
                                    '[action.index]': {reducers: ['todoReaction.ToggleItem': Function]}
                                }
                            }
                        }
                     }
                }
             }
 }
 */
function prepareReaction(reaction, reactionName, substitutions, group) {

    var originalreactionName = reactionName;
    reactionName = (group ? (group + '.') : '')  + reactionName;

    if (!reaction.action)
        throw new Error("redux-reactions: Missing actions property in " + reactionName);

    var actionFunction = function () {
        var action = reaction.action.apply(this, arguments);
        action.type = reactionName;
        return action;
    };
    if (group) {
        Reactions.actionsGroup[group] =  Reactions.actionsGroup[group] || {};
        Reactions.actionsGroup[group][originalreactionName] = actionFunction;
    }

    Reactions.actions[reactionName] = actionFunction;
    Reactions.actionsStateMap[reactionName] = substitutions;
    Reactions.groupStateMap[group] = substitutions;

    if (!reaction.state)
        return;

    // Process each reducer and produce composition state map
    reaction.state.map(function (sliceReducer, sliceKey)  {

        var reactionNode = Reactions.reducerTree[reactionName] = Reactions.reducerTree[reactionName] || {reducers: []};
        var reactionSlice = substitute(sliceReducer.slice, substitutions);

        reactionSlice.map(function processStateNode(stateNode) {
            var stateNodeKey = typeof stateNode == 'function' ? stateNode.toString() : stateNode;
            reactionNode.children = reactionNode.children || {};
            reactionNode.children[stateNodeKey] = reactionNode.children[stateNodeKey] || {reducers: []}
            if (typeof stateNode === 'function')
                reactionNode.children[stateNodeKey].evaluate = stateNode;
            reactionNode = reactionNode.children[stateNodeKey];
        });

        reactionNode.reducers.push(sliceReducer);
    });

    function substitute(reactionState, substitutions) {
        if (substitutions && substitutions[reactionState[0]]) {
            var substitution = substitutions[reactionState[0]];
            substitution.map((subElement) => {
                if (typeof subElement == 'function')
                    subElement.noMap = true;
            });
            return substitution.slice().concat(reactionState.slice(1));
        } else
            return reactionState;
    }
}


function stateChanges (oldState, newState) {

    var accumulator = {nodes: [], level: 0, oldState: oldState, newState: newState};
    var changes = "";
    Object.getOwnPropertyNames(newState).reduce(reducer, accumulator);
    return changes;

    function reducer(accumulator, propOrIndex) {

        accumulator.nodes[accumulator.level] = propOrIndex;
        var newState = accumulator.newState[propOrIndex];
        var oldState = accumulator.oldState[propOrIndex];

        if (newState !== oldState) {
            changes += accumulator.nodes.join(".") + ";";
        }

        if (typeof oldState != 'undefined' && typeof newState != 'undefined') {
            var subAccumulator = {nodes: accumulator.nodes.slice(), oldState: oldState, newState: newState, level: accumulator.level + 1};
            if (newState instanceof Array) {
                if (newState.length == oldState.length)
                    newState.reduce(arrayReducer, subAccumulator);
            } else if ((typeof newState).match(/number|string|boolean|undefined/) || newState === null) {
            } else {
                Object.getOwnPropertyNames(newState).reduce(reducer, subAccumulator)
            }
        }
        return accumulator;
    }
    function arrayReducer(accumulator, currentValue, currentIndex) {
        return reducer(accumulator, currentIndex);
    }
}