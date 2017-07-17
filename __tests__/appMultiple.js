import React, {Component} from 'react';
import {Reactions} from '../index.js';
import { createStore, applyMiddleware} from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

// Demonstrate how we can have multiple todo lists without affecting todoList action
// In this example you have multiple lists only one of which is active at any time.
// Actions/reducers apply to the currently active list.

import {todoList} from './app.js';
var initialState = {
    domain: {
        currentListIndex: 0,
        lists: [{
            todoList: [],
            nextId: 0
        }]
    },
    app: {
        lists: [{
            filter: 'SHOW_ALL'
        }]
    }
};

var lists = {
    setCurrentList: {
        action:
            (index) => ({index: index}),
        state: [{
            slice: ['domain', 'currentListIndex'],
            set: (action) => action.index
        }]}
}
var stateMap = {
    app: ['app', 'lists', (state, list, index) => index == state.domain.currentListIndex],
    domain: ['domain', 'lists', (state, list, index) => {
        return index == state.domain.currentListIndex
    }]
}


describe('Multiple todoLists', () => {
    beforeAll(() => {
        Reactions.clear(); // To keep tests separate
        Reactions.addReactions(lists);
        Reactions.addReactions(todoList, stateMap);
    });
    it ('can reduce standalone', () => {
        var state = Object.assign({}, initialState);
        var action = Reactions.actions.AddItem("First Item");
        var oldState = state;

        state = Reactions.reduce(state, action);
        expect(state.domain.lists[0].todoList.length).toEqual(1);
        expect(state.domain.lists[0].todoList[0].text).toEqual("First Item");
        expect(state.domain.lists[0].todoList[0].completed).toEqual(false);
        expect(state.domain.lists[0].nextId).toEqual(1);
        expect(state.domain.lists[0].todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState))
            .toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;domain.lists.0.nextId;app;app.lists;app.lists.0;');

        action = Reactions.actions.AddItem("Second Item");
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.lists[0].todoList.length).toEqual(2);
        expect(state.domain.lists[0].todoList[1].text).toEqual("Second Item");
        expect(state.domain.lists[0].todoList[1].completed).toEqual(false);
        expect(state.domain.lists[0].nextId).toEqual(2);
        expect(state.domain.lists[0].todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState))
            .toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;domain.lists.0.nextId;app;app.lists;app.lists.0;');

        action = Reactions.actions.ToggleItem(0);
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.lists[0].todoList[0].completed).toEqual(true);
        expect(state.domain.lists[0].todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState))
            .toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;domain.lists.0.todoList.0;domain.lists.0.todoList.0.completed;');

        action = Reactions.actions.FilterList("SHOW_ACTIVE");
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.app.lists[0].filter).toEqual("SHOW_ACTIVE");
        expect(Reactions.stateChanges(state, oldState)).toEqual('app;app.lists;app.lists.0;app.lists.0.filter;');

        action = Reactions.actions.DeleteItem(0);
        oldState = state;
        state = Reactions.reduce(state, action);
        expect(state.domain.lists[0].todoList.length).toEqual(1);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;');


    });
    it ('can reduce via redux', () => {

        var state = Object.assign({}, initialState);
        var oldState;
        const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
        const store = createStoreWithMiddleware(Reactions.reduce, state);
        store.subscribe(() => state = store.getState());

        store.dispatch(Reactions.actions.setCurrentList(0));

        oldState = state;
        store.dispatch(Reactions.actions.AddItem("First Item"));
        expect(state.domain.lists[0].todoList.length).toEqual(1);
        expect(state.domain.lists[0].todoList[0].text).toEqual("First Item");
        expect(state.domain.lists[0].todoList[0].completed).toEqual(false);
        expect(state.domain.lists[0].nextId).toEqual(1);
        expect(state.domain.lists[0].todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState))
            .toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;domain.lists.0.nextId;app;app.lists;app.lists.0;');

        oldState = state;
        store.dispatch(Reactions.actions.AddItem("Second Item"));
        expect(state.domain.lists[0].todoList.length).toEqual(2);
        expect(state.domain.lists[0].todoList[1].text).toEqual("Second Item");
        expect(state.domain.lists[0].todoList[1].completed).toEqual(false);
        expect(state.domain.lists[0].nextId).toEqual(2);
        expect(state.domain.lists[0].todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState))
            .toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;domain.lists.0.nextId;app;app.lists;app.lists.0;');

        oldState = state;
        store.dispatch(Reactions.actions.ToggleItem(0));
        expect(state.domain.lists[0].todoList[0].completed).toEqual(true);
        expect(state.domain.lists[0].todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState))
            .toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;domain.lists.0.todoList.0;domain.lists.0.todoList.0.completed;');

        oldState = state;
        store.dispatch(Reactions.actions.FilterList("SHOW_ACTIVE"));
        expect(state.app.lists[0].filter).toEqual("SHOW_ACTIVE");
        expect(Reactions.stateChanges(state, oldState)).toEqual('app;app.lists;app.lists.0;app.lists.0.filter;');

        oldState = state;
        store.dispatch(Reactions.actions.DeleteItem(0));
        expect(state.domain.lists[0].todoList.length).toEqual(1);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.lists;domain.lists.0;domain.lists.0.todoList;');


    });

})