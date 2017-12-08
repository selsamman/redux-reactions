import React, {Component} from 'react';
import Reactions from '../src/index.js';
import { Provider } from 'react-redux'
import { createStore, applyMiddleware} from 'redux';
import thunk from 'redux-thunk';
import { shallow, mount, render } from 'enzyme';

// Test the React connect function

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
        },
        todoList: [],
        nextId: 0
    },
    app: {
        list1: {filter: 'SHOW_ALL'},
        list2: {filter: 'SHOW_ALL'},
        list3: {filter: 'SHOW_ALL'},
        filter: 'SHOW_ALL'
    }
};

class Test extends Component {
    render () {
        return (
            <a onClick={this.props.AddItem}>
                <span>{this.props.todoList.length}</span>
            </a>
        )
    }
}
class TestWithThunk extends Component {
    render () {
        return (
            <a onClick={this.props.AddItemWithThunk}>
                <span>{this.props.todoList.length}</span>
            </a>
        )
    }
}
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
        Reactions.addReactions([todoList, domainSelector]);
    });
    it ('can reduce lists', () => {

        // Setup the store
        var state = Object.assign({}, initialState);
        const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
        const store = createStoreWithMiddleware(Reactions.reduce, state);

        // Use default action mapper
        var TestList1 = Reactions.connect('list1',
            (state, props) => ({todoList: state.domain.todoList}))(TestWithThunk);
        const wrapper1 = mount(<Provider store={store}><TestList1 /></Provider>);
        wrapper1.find('a').simulate('click');
        expect(wrapper1.find('span').html()).toEqual('<span>1</span>');

        // Use explicit action mapper
        var TestList2 = Reactions.connect('list2',
            (state, props) => ({todoList: state.domain.todoList}),
            (ownProps, actions) =>  (Reactions.bindActionCreators({
                AddItem: actions.AddItem.bind(null, 'Foo')
            }, store.dispatch)))(Test);
        const wrapper2 = mount(<Provider store={store}><TestList2 /></Provider>);
        wrapper2.find('a').simulate('click');
        wrapper2.find('a').simulate('click');
        expect(wrapper2.find('span').html()).toEqual('<span>2</span>');
        expect(store.getState().domain.list2.todoList[0].text).toEqual('Foo');

        // Use default action mapper and default state mapper
        var TestList3 = Reactions.connect('list3')(Test);
        const wrapper3 = mount(<Provider store={store}><TestList3 /></Provider>);
        wrapper3.find('a').simulate('click');
        wrapper3.find('a').simulate('click');
        wrapper3.find('a').simulate('click');
        expect(wrapper3.find('span').html()).toEqual('<span>3</span>');

        // Use default action mapper without a group
        var TestList4 = Reactions.connect()(Test);
        const wrapper4 = mount(<Provider store={store}><TestList4 /></Provider>);
        wrapper4.find('a').simulate('click');
        expect(wrapper4.find('span').html()).toEqual('<span>1</span>');
        expect(store.getState().domain.todoList.length).toEqual(1);

    });

})