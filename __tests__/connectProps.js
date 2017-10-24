import React, {Component} from 'react';
import Reactions from '../src/index.js';
import { Provider } from 'react-redux'
import { createStore, applyMiddleware} from 'redux';
import thunk from 'redux-thunk';

//Test the connectProps function of Reactions

import {todoList} from './app.js';
var initialState = {
    domain: {
        list1: {
            todoList: [],
            nextId: 0
        },
        list2: {
            todoList: [],
            nextId: 0
        },
        list3: {
            todoList: [],
            nextId: 0
        }
    },
    app: {
        list1: {filter: 'SHOW_ALL'},
        list2: {filter: 'SHOW_ALL'},
        list3: {filter: 'SHOW_ALL'}
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
var stateMap3 = {
    app: ['app', 'list3'],
    domain: ['domain', 'list3']
}
describe('Two todoLists', () => {
    beforeAll(() => {
        Reactions.clear(); // To keep tests separate
        Reactions.addReactions(todoList, stateMap1, 'list1');
        Reactions.addReactions(todoList, stateMap2, 'list2');
        const domainSelector = {
            todoList: (state) => {
                return state.domain.todoList}
        };
        Reactions.addReactions([todoList, domainSelector], stateMap3, 'list3');

    });
    it ('can reduce lists', () => {

        // Setup the store
        var state = Object.assign({}, initialState);
        const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
        const store = createStoreWithMiddleware(Reactions.reduce, state);

        // Use default action mapper
        const props1 = Reactions.connectProps(store, 'list1', (state, props) => ({todoList: state.domain.todoList}))
        props1.AddItemWithThunk('foo');
        expect(Reactions.getState(store, 'list1').domain.todoList[0].text).toEqual('foo');

        // Use explicit action mapper
        const props2 = Reactions.connectProps(store, 'list2',
            (state, props) => ({todoList: state.domain.todoList}),
            (ownProps, actions) =>  (Reactions.bindActionCreators({
                BoundItemAdd: actions.AddItem.bind(null, 'Bound')
            }, store.dispatch)));
        props2.BoundItemAdd();
        expect(Reactions.getState(store, 'list2').domain.todoList[0].text).toEqual('Bound');

        // Use default action mapper and default state mapper
        const props3 = Reactions.connectProps(store, 'list3');
        props3.AddItem('foo');
        props3.AddItemWithThunk('bar');
        expect(Reactions.getState(store, 'list3').domain.todoList[0].text).toEqual('foo');
        expect(Reactions.getState(store, 'list3').domain.todoList[1].text).toEqual('bar');
        const props3After = Reactions.connectProps(store, 'list3');
        expect(props3After.todoList[0].text).toEqual('foo');
        expect(props3After.todoList[1].text).toEqual('bar');
    });

})