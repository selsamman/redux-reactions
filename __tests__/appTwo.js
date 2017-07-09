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
        list1: {
            todoList: [
            ],
            nextId: 0
        },
        list2: {
            todoList: [
            ],
            nextId: 0
        }
    },
    app: {
        list1: {filter: 'SHOW_ALL'},
        list2: {filter: 'SHOW_ALL'}
    }
};


var stateMap1 = {
    app: ['app', 'list1'],
    domain: ['domain', 'list1']
}
var stateMap2 = {
    app: ['app', 'list2'],
    domain: ['domain', 'list2']
}

describe('Two todoLists', () => {
    beforeAll(() => {
        Reactions.clear(); // To keep tests separate
        Reactions.addReactions(todoList, stateMap1, 'list1');
        Reactions.addReactions(todoList, stateMap2, 'list2');

    });
    it ('can reduce lists', () => {

        var state = Object.assign({}, initialState);
        const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
        const store = createStoreWithMiddleware(Reactions.reduce, state);
        store.subscribe(() => state = store.getState());

        store.dispatch(Reactions.actionsGroup.list1.AddItem("First Item"));
        expect(state.domain.list1.todoList.length).toEqual(1);
        expect(state.domain.list1.todoList[0].text).toEqual("First Item");
        expect(state.domain.list1.todoList[0].completed).toEqual(false);
        expect(state.domain.list1.nextId).toEqual(1);
        expect(state.domain.list1.todoList instanceof Array).toEqual(true);

        store.dispatch(Reactions.actionsGroup.list1.AddItem("Second Item"));
        expect(state.domain.list1.todoList.length).toEqual(2);
        expect(state.domain.list1.todoList[1].text).toEqual("Second Item");
        expect(state.domain.list1.todoList[1].completed).toEqual(false);
        expect(state.domain.list1.nextId).toEqual(2);

        store.dispatch(Reactions.actionsGroup.list1.ToggleItem(0));
        expect(state.domain.list1.todoList[0].completed).toEqual(true);

        store.dispatch(Reactions.actionsGroup.list1.FilterList("SHOW_ACTIVE"));
        expect(state.app.list1.filter).toEqual("SHOW_ACTIVE");

        store.dispatch(Reactions.actionsGroup.list1.DeleteItem(0));
        expect(state.domain.list1.todoList.length).toEqual(1);

        store.dispatch(Reactions.actionsGroup.list2.AddItem("First Item"));
        expect(state.domain.list2.todoList.length).toEqual(1);
        expect(state.domain.list2.todoList[0].text).toEqual("First Item");
        expect(state.domain.list2.todoList[0].completed).toEqual(false);
        expect(state.domain.list2.nextId).toEqual(1);

        store.dispatch(Reactions.actionsGroup.list2.AddItem("Second Item"));
        expect(state.domain.list2.todoList.length).toEqual(2);
        expect(state.domain.list2.todoList[1].text).toEqual("Second Item");
        expect(state.domain.list2.todoList[1].completed).toEqual(false);
        expect(state.domain.list2.nextId).toEqual(2);
        expect(state.domain.list2.todoList instanceof Array).toEqual(true);

        store.dispatch(Reactions.actionsGroup.list2.ToggleItem(0));
        expect(state.domain.list2.todoList[0].completed).toEqual(true);
        expect(state.domain.list2.todoList instanceof Array).toEqual(true);

        store.dispatch(Reactions.actionsGroup.list2.FilterList("SHOW_ACTIVE"));
        expect(state.app.list2.filter).toEqual("SHOW_ACTIVE");

        store.dispatch(Reactions.actionsGroup.list2.DeleteItem(0));
        expect(state.domain.list2.todoList.length).toEqual(1);
    });

})