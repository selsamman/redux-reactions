# redux-reactions
## Reactions simplifies actions and reducers:
* Actions and reducers defined right next to each other.
* No need for action type strings to bind actions and reducers
* No need to worry about not-mutating the state
* No need to wire together a reducer heirarchy for your state tree.
* In fact you don't define reducers at all
* You just define functions that return a state slice and redux-reactions will take care of merging that into the state.
## Usage

Add reactions to your project
```
npm install --save redux-reactions
```

Define your Reactions.  Reactions are a combination of reducers and actions:
```
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
```
Add your reaction definitons as reactions:
```
import {Reactions} from 'redux-reactions';
Reactions.addReactions(todoList);
```
Connect them to redux:
```
const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
var state = {
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
You can easily write tests your reactions and ensure that not only do they do what you want them to do but that they don't mutate other parts of the state.  The stateChanges member function returns a string which describes which state slices have changed: 
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

##Anatomy of a Reaction

A reaction is a definition of both an action and a reaction.  Each reaction is defined as a property where the property name is the reaction type.  
```
var todoList = {
    AddItem: {
```
The property contains further properties that
* define the function that returns an action you can dispatch:
```
        action:
            (idToToggle) => ({id: idToToggle}),
```
* define the state that will be affected by the action and how that state will be changed: 
```
        state: [{
            slice: ['domain', 'todoList', (action, state, item) => action.id == item.id],
            assign:    (action, state, item) => ({completed: !item.completed})
        }]},
```
The state definition describes the specific slice of the tree that will be moddified.  In this example it is **_domain.todoList[x]_**, where **_x_** is the todoList item that matches **_action.id == item.id_**.  You also define a property that describe what the reducer should do: :
* **assign: (action, state, item)** - a function that will return properties to be merged into a copy of the state (similar to Object.assign) 
* **set: (action, state, item)** - a function returning a new value for that slice of the state
* **append: (action, state, item)** - a function returning a new value to be concatenated to this slice of the state which must be an array.  Similar to Array.concat.
* **delete: true** - returns undefined for the new state.  Use for array elements which are to be deleted since any elements set to null or undefined will be removed from the array.

Assign, set and append functions have these arguments:
* **action** - the action object returned from the action function
* **state** - the root of the state heirarchy
* **item** - the particular slice of the state heirarchy as defined by the slice property

Thats pretty much it.  Please be advised this project is alpha and has yet to be incorporated into a React project.