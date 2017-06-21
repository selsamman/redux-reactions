export var Reactions = {
    actions: {},
    reducerTree: {},
    addReactions: addReactions,
    reduce: topLevelReducer,
    stateChanges: stateChanges
};

function addReactions (newReactions) {
    for (var reactionName in newReactions)
        prepareReaction(newReactions[reactionName], reactionName);
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
            return reducer.set.call(null, action, rootState, newState);
        } else if (reducer.append) {
            return newState.concat(reducer.append.call(null, action, rootState, newState));
        } else if (reducer.assign) {
            return Object.assign({}, newState, reducer.assign.call(null, action, rootState, newState));
        } else if (reducer.delete) {
            return undefined;
        } else {
            throw new Error('missing set, assign, append or delete on state for reaction: ' + action);
        }
    }
    // Find the value of a slice key in the format of [action|state.prop1.prop2 etc]
    function evaluate (reactionNodeKey, reactionNodeValue, element, propOrIndex) {
        if (typeof reactionNodeValue.evaluate == "function")
            return reactionNodeValue.evaluate.call(null, action, rootState, element);
        else
            return reactionNodeKey === propOrIndex;
    }
};

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
function prepareReaction(reaction, reactionName) {

    if (!reaction.action)
        throw new Error("redux-reactions: Missing actions property in " + reactionName);

    Reactions.actions[reactionName] = function () {
        var action = reaction.action.apply(null, arguments);
        action.type = reactionName;
        return action;
    };

    if (!reaction.state)
        throw new Error("redux-reactions: Missing state property in " + reactionName);

    // Process each reducer and produce composition state map
    reaction.state.map(function (sliceReducer, sliceKey)  {

        var reactionNode = Reactions.reducerTree[reactionName] = Reactions.reducerTree[reactionName] || {reducers: []};

        sliceReducer.slice.map(function processStateNode(stateNode) {
            var stateNodeKey = typeof stateNode == 'function' ? stateNode.toString() : stateNode;
            reactionNode.children = reactionNode.children || {};
            reactionNode.children[stateNodeKey] = reactionNode.children[stateNodeKey] || {reducers: []}
            if (typeof stateNode === 'function')
                reactionNode.children[stateNodeKey].evaluate = stateNode;
            reactionNode = reactionNode.children[stateNodeKey];
        });

        reactionNode.reducers.push(sliceReducer);
    });
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
// Normalize object and a array reduction so we allways have and index into the state being copied
