import React, {Component} from 'react';
import {Reactions} from '../index.js';
import { createStore, applyMiddleware} from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

var todoList = {
    AddItem: {
        action:
            (text) => ({text: text}),
        state: [{
            slice: ['domain', 'nextId'],
            set:    (action, state, nextId) => nextId + 1
        },{
            slice: ['domain', 'todoList'],
            append:    (action, state) => ({text: action.text, id: state.domain.nextId, completed: false})
        },{
            slice: ['app', 'filter'],
            set:    (action, state, filter) => filter.filter === 'SHOW_ACTIVE' ? filter.filter : 'SHOW_ALL'
        }]},
    DeleteItem: {
        action:
            (idToDelete) => ({id: idToDelete}),
        state: [{
            slice: ['domain', 'todoList', (action, state, item) => action.id == item.id],
            delete:  true
        }]},
    ToggleItem: {
        action:
            (idToToggle) => ({id: idToToggle}),
        state: [{
            slice: ['domain', 'todoList', (action, state, item) => action.id == item.id],
            assign:    (action, state, item) => ({completed: !item.completed})
        }]},
    FilterList: {
        action:
            (filter) => ({filter: filter}),
        state: [{
            slice: ['app', 'filter'],
            set:    (action, state, filter) => action.filter
        }]}
};
/*
    slice: ['domain', 'tickets', currentTicket, 'activity', currentActivity, update]
    slice: ['domain', 'tickets', currentTicket, 'history', allActivity, age]
    slice: ['domain', 'tickets', previousTicket, 'modified']

    domain: {
        children: {
            tickets: {
                children: {
                    'function currentTicket': {
                        children: {
                            activity: {
                                children: {
                                    'function currentActivity': {
                                        reducers: [Function]
                                    }
                                }
                            },
                            history: {
                                children: {
                                    'function allActivity': {
                                        reducers: [Function]
                                    }
                                }
                            }
                    },
                    'function previousTicket': {
                         children: {
                            'modified: {
                                reducers: [Function]
                             }
                         }
                    }


*/

Reactions.addReactions(todoList);

describe('Basic Low Level Sanity', () => {
    it('ruducerTree correct', () => {
        var map = Reactions.reducerTree
        expect(typeof map.AddItem).toEqual('object')
        expect(typeof map.DeleteItem).toEqual('object')
        expect(typeof map.ToggleItem).toEqual('object')
        expect(typeof map.FilterList).toEqual('object')

        expect(typeof map.AddItem.children.domain).toEqual('object')
        expect(       map.AddItem.children.domain.reducers.length).toEqual(0)
        expect(typeof map.AddItem.children.domain.children.todoList).toEqual('object')
        expect(       map.AddItem.children.domain.children.todoList.reducers.length).toEqual(1)
        expect(typeof map.AddItem.children.domain.children.nextId).toEqual('object')
        expect(       map.AddItem.children.domain.children.nextId.reducers.length).toEqual(1)
        expect(typeof map.AddItem.children.app).toEqual('object')
        expect(       map.AddItem.children.app.reducers.length).toEqual(0)
        expect(typeof map.AddItem.children.app.children.filter).toEqual('object')
        expect(       map.AddItem.children.app.children.filter.reducers.length).toEqual(1)

        expect(typeof map.DeleteItem.children.domain).toEqual('object')
        expect(       map.DeleteItem.children.domain.reducers.length).toEqual(0)
        expect(typeof map.DeleteItem.children.domain.children.todoList).toEqual('object')
        expect(       map.ToggleItem.children.domain.children.todoList.reducers.length).toEqual(0)
        var item = Object.keys(map.ToggleItem.children.domain.children.todoList.children)[0];
        expect(       map.ToggleItem.children.domain.children.todoList.children[item].reducers.length).toEqual(1)

        expect(typeof map.ToggleItem.children.domain).toEqual('object')
        expect(       map.ToggleItem.children.domain.reducers.length).toEqual(0)
        expect(typeof map.ToggleItem.children.domain.children.todoList).toEqual('object')
        expect(       map.ToggleItem.children.domain.children.todoList.reducers.length).toEqual(0)
        var item = Object.keys(map.ToggleItem.children.domain.children.todoList.children)[0];
        expect(       map.ToggleItem.children.domain.children.todoList.children[item].reducers.length).toEqual(1)

        expect(typeof map.FilterList.children.app).toEqual('object')
        expect(       map.FilterList.children.app.reducers.length).toEqual(0)
        expect(typeof map.FilterList.children.app.children.filter).toEqual('object')
        expect(       map.FilterList.children.app.children.filter.reducers.length).toEqual(1)

    })
    it ('can detect changes', () => {
        var newState, oldState;

        var oldState = {a: 1, b: 2, c: 3};
        var newState = Object.assign({}, oldState, {b: 2.1});
        expect(Reactions.stateChanges(oldState, newState)).toEqual("b;");

        var oldState = {a: {a1: 11, a2: 12}, b: 2, c: {c1: "c1", c2: "c2"}};
        var newState = Object.assign({}, oldState,
            {a: Object.assign({}, oldState.a, {a2: "122"})},
            {c: Object.assign({}, oldState.c, {c1: "111"})});
        expect(Reactions.stateChanges(oldState, newState)).toEqual("a;a.a2;c;c.c1;");

        var oldState = {a: [{a1: 11}, {a2: 12}], b: 2, c: ["c1", "c2"]};
        var newState = Object.assign({}, oldState,
            {a: oldState.a.slice()},
            {c: oldState.c.slice()});
        newState.a[1] = {a2: 122};
        newState.c[0] = "c11";
        expect(Reactions.stateChanges(oldState, newState)).toEqual("a;a.1;a.1.a2;c;c.0;");
    });

    it ('can process actions', () => {

        var action = Reactions.actions.AddItem("New Kid");
        expect(action.text).toEqual("New Kid");

        var action = Reactions.actions.DeleteItem(0);
        expect(action.id).toEqual(0);

        var action = Reactions.actions.ToggleItem(0);
        expect(action.id).toEqual(0);

        var action = Reactions.actions.FilterList("SHOW_ALL");
        expect(action.filter).toEqual("SHOW_ALL");

    });

    it ('can reduce standalone', () => {
        var state = {
            domain: {
                todoList: [
                ],
                nextId: 0
            },
            app: {filter: 'SHOW_ALL'}
        };
        var oldState, action;


        action = Reactions.actions.AddItem("First Item");
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.todoList.length).toEqual(1);
        expect(state.domain.todoList[0].text).toEqual("First Item");
        expect(state.domain.todoList[0].completed).toEqual(false);
        expect(state.domain.nextId).toEqual(1);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.nextId;app;');

        action = Reactions.actions.AddItem("Second Item");
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.todoList.length).toEqual(2);
        expect(state.domain.todoList[1].text).toEqual("Second Item");
        expect(state.domain.todoList[1].completed).toEqual(false);
        expect(state.domain.nextId).toEqual(2);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.nextId;app;');

        action = Reactions.actions.ToggleItem(0);
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.todoList[0].completed).toEqual(true);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.todoList.0;domain.todoList.0.completed;');

        action = Reactions.actions.FilterList("SHOW_ACTIVE");
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.app.filter).toEqual("SHOW_ACTIVE");
        expect(Reactions.stateChanges(state, oldState)).toEqual('app;app.filter;');

        action = Reactions.actions.DeleteItem(0);
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.todoList.length).toEqual(1);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;');


    });
    it ('can reduce via redux', () => {
        var state = {
            domain: {
                todoList: [
                ],
                nextId: 0
            },
            app: {filter: 'SHOW_ALL'}
        };
        var oldState;
        const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
        const store = createStoreWithMiddleware(Reactions.reduce, state);
        store.subscribe(() => state = store.getState());

        oldState = state;
        store.dispatch(Reactions.actions.AddItem("First Item"));
        expect(state.domain.todoList.length).toEqual(1);
        expect(state.domain.todoList[0].text).toEqual("First Item");
        expect(state.domain.todoList[0].completed).toEqual(false);
        expect(state.domain.nextId).toEqual(1);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.nextId;app;');

        oldState = state;
        store.dispatch(Reactions.actions.AddItem("Second Item"));
        expect(state.domain.todoList.length).toEqual(2);
        expect(state.domain.todoList[1].text).toEqual("Second Item");
        expect(state.domain.todoList[1].completed).toEqual(false);
        expect(state.domain.nextId).toEqual(2);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.nextId;app;');

        oldState = state;
        store.dispatch(Reactions.actions.ToggleItem(0));
        expect(state.domain.todoList[0].completed).toEqual(true);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.todoList.0;domain.todoList.0.completed;');

        oldState = state;
        store.dispatch(Reactions.actions.FilterList("SHOW_ACTIVE"));
        expect(state.app.filter).toEqual("SHOW_ACTIVE");
        expect(Reactions.stateChanges(state, oldState)).toEqual('app;app.filter;');

        oldState = state;
        store.dispatch(Reactions.actions.DeleteItem(0));
        expect(state.domain.todoList.length).toEqual(1);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;');


    });

})