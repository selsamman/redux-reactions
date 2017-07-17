# redux-redactions
## Simplify Redux
React and Redux make a powerful way to organize your state.  In their vanilla form you create actions which are dispatched by your components and then handled by reducer functions which ultimately render a new state with only the relevant state properties mutated.  This means you have to write:
* Actions
* Reducers
* Action types constants to bind the actions and reducers
* Higher level reducers that call down to your more specific reducers to ensure only the relevant state properties are mutated

Redactions simplifies the organization by combining an action an function that modifies a specific slice of the state.  Because you declare the specific slice of the state to be modified, Redactions handles the higher level reduction and calls your function to get a new state property value. It also has declarative ways to merge in new properties, append to arrays or delete array elements such that you never have to worry about mutation.

## Usage

Add reactions to your project
```
npm install --save redux-redactions
```

> This is still a work in progres yet to be incorporated into a serious React project.


Define your Reactions.  Reactions are a combination of reducers and actions:
```
let todoList = {
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
```
Add your reaction definitions as reactions:
```
import {Reactions} from 'redux-redactions';
Reactions.addReactions(todoList);
```
Connect them to redux:
```
const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
let state = {
    domain: {
        todoList: [
        ],
        nextId: 0
    },
    app: {filter: 'SHOW_ALL'}
};
const store = createStoreWithMiddleware(Reactions.reduce, state);
```
Dispatch them:
```
store.dispatch(Reactions.actions.AddItem("First Item"));
```
You can easily write tests for your reactions and ensure that not only do they do what you want them to do but that they don't mutate other parts of the state.  The stateChanges member function returns a string which describes which state slices have changed: 
```
        let oldState = state;
        store.dispatch(Reactions.actions.AddItem("First Item"));
        expect(state.domain.todoList.length).toEqual(1);
        expect(state.domain.todoList[0].text).toEqual("First Item");
        expect(state.domain.todoList[0].completed).toEqual(false);
        expect(state.domain.nextId).toEqual(1);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.nextId;app;');

```
## Anatomy of a Reaction
A reaction is a definition of both an action and a reducer handler.  Each reaction is defined as a property where the property name is the reaction type.  
```
let todoList = {
    AddItem: {
```
The property contains further properties that
* define the function that returns an action you can dispatch:
```
        action:
            (idToToggle) => ({id: idToToggle}),
```
* define the state slice that will be affected by the action and how that state will be changed: 
```
        state: [{
            slice: ['domain', 'todoList', (action, state, item) => action.id == item.id],
            assign:    (action, state, item) => ({completed: !item.completed})
        }]},
```
The state slice  defines the particlular part of the state hierarchy that your reducer handler will effect.  It is defined as an array of property names describes the state property hierarchy.  When a state property is an array or a hash you may specify a function that will be used to specify array or hash element.  This function is called for every element and returns true to select that element.  It is passed:
 * the action
 * the top level state
 * the element itself,
 * the index of the element if the property is an array
  
  The state slice also defines the state handler which is a function that will either return a new value for the state element or an object to be merged with the existing state.  These types of state handlers are possible and specified by property key::
* **assign: (action, state, item)** - a function that will return properties to be merged into a copy of the state (similar to Object.assign) 
* **set: (action, state, item)** - a function returning a new value for that slice of the state
* **append: (action, state, item)** - a function returning a new value to be concatenated to this slice of the state which must be an array.  Similar to Array.concat.
* **delete: true** - returns undefined for the new state.  Use for array elements which are to be deleted since any elements set to null or undefined will be removed from the array.

The assign, set and append state handlers have these arguments:
* **action** - the action object returned from the action function
* **state** - the root of the state heirarchy
* **item** - the particular slice of the state heirarchy as defined by the slice property

> Important: The state slice property must exist in the state for the state handler to get executed.  It is assumed that you will initialize your state with null or undefined values if there is no reason to have an actual value for a given property.

## State Composition

Although your reactions may be written to be aware of the entire state graph you might actually want to have them be independent of where they fit into the state of a large application.  For example you might have multiple todoLists and select a  'current one' or you might have several todoLists active at the same time.  In all cases your reactions need not know anything other than what they need to manage a single todoList just as you would expect your todoList component to only know about the todoList it was dealing with.
 
Let's say you wanted to have multiple todoLists with one active at a time. Your state might look like this:
```
let initialState = {
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
 ```
 This example uses the convention of dividing state into domain which reflects the data itself for a todoList and app which represents the workings of the application that manages the todoList.  We need to 'map' the set of actions to one particular instance of the lists array within domain and app.  This is done with a state map:
 
 ```
let stateMap = {
    app: ['app', 'lists', (state, list, index) => index == state.currentListIndex],
    domain: ['domain', 'lists', (state, list, index) => index == state.currentListIndex]
}
 ```
You add the reactions along with the state map:
 ```
Reactions.addReactions(todoList, stateMap);
 ````
This does two things:
* Substitutes the 'app' and 'domain' slice elements for the ones specified in the state map such that all the original actions will apply to the correct todoList.  
* Substitutes the 'app' and 'domain' properties in the state passed to the reaction functions where state is passed such that they point to the correct todoList. 
 
This is great if you want to have multiple todoLists and you want to simply set the current one but what if you actually have multiple active todoLists on your page.  In that case your state might look like this:
 ```
let initialState = {
    domain: {
        list1: {
            todoList: [],
            nextId: 0
        },
        list2: {
            todoList: [],
            nextId: 0
        }
    },
    app: {
        list1: {filter: 'SHOW_ALL'},
        list2: {filter: 'SHOW_ALL'}
    }
};
```
Now you need two state maps ot map app and domain to the correct part of the overall state:
 ```
 let stateMap1 = {
     app: ['app', 'list2'],
     domain: ['domain', 'list1']
 }
let stateMap2 = {
    app: ['app', 'list2'],
    domain: ['domain', 'list2']
}
```
And you can now connect each state map to the same set of actions by passing a group name when you add each set of reactions: 
 ```
  Reactions.addReactions(todoList, stateMap1, 'list1');
  Reactions.addReactions(todoList, stateMap2, 'list2');
 ```
This will result in two sets of actions each of which has a different state map.  You can refer to them as:
```
    Reactions.actionGroup.list1.AddItem
    Reactions.actionGroup.list2.AddItem
````
This makes it easy to connect up a component that deals with one list or the other:
```
let todoList1 = connect(
    state => ({domain: {todoList: state.domain.list1}, app: {todoList: state.app.list1),
    dispatch => ({actions: bindActionCreators(Reactions.actionGroup.list1)
)(TodoList);

let todoList2 = connect(
   state => ({domain: {todoList: state.domain.list2}, app: {todoList: state.app.list2)),
    dispatch => ({actions: bindActionCreators(Reactions.actionGroup.list1})
)(TodoList);
````
In effect what we have created is a structure for reducers and actions that is parallel to the mechanism you would normally use in connecting a component to state -- that is setting the state props to reflect just the part of the state relevant to the component instance.

## Automatically Connecting to a React Component

Reactions.connect is a wrapper around connect that maps reaction groups to a component.  It is used in place of the redux connect. 
```
let todoList1 = Reactions.connect('list1')(TodoList);
```
It will map the state properties from 'list1' to your properties (domain and app in this case) and will map all of the actions in actionGroup.list1 as bound actions to your properties.

You can also manually specify the mapStateToProps function and map them yourself.   The state you recieve in the state parameter will have already been mapped for you using the stateMap so that in this cas you map directly to state.domain rather than state.domain.list1
```
let todoList1 = Reactions.connect('list1', 
    (state, props) => ({domain: state.domain, app: state.app}))(Test);
```
You also manually specify the mapActionToProps function and map the actions your self.  You will recieve an additional parameter with the actions for the actions group.
```
Reactions.connect('list2', undefined,
    (dispatch, ownProps, actions) => ({
        actions: bindActionCreators({
            AddItem: () => actions.AddItem('Foo')
        }, dispatch)
    }))(Test);
```
Of course you may specify both manually.  See the connect.js Jest test for an example of all three.