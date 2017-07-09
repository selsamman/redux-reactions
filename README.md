# redux-redactions
## Reactions simplifies actions and reducers:
* Actions and their associated reducers defined right next to each other.
* No need for action type strings to bind actions and reducers
* No need to worry about not mutating the state
* No need to wire together a reducer hierarchy for your state tree.
* In fact no need to write reducer functions at all
* The master reducer traverses the state tree calling your action function to get a value to merge in.
## Usage

Add reactions to your project
```
npm install --save redux-redactions
```

> This is still a work in progres yet to be incorporated into a serious React project.


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
import {Reactions} from 'redux-redactions';
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

A reaction is a definition of both an action and a reducer handler.  Each reaction is defined as a property where the property name is the reaction type.  
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

##State Composition

Although your reactions may be written to be aware of the entire state graph you might actually want to have them be independent of where they fit into the state of a large application.  For example you might have multiple todoLists and select a  'current one' or you might have several todoLists active at the same time.  In all cases your reactions need not know anything other than what they need to manage a single todoList just as you would expect your todoList component to only know about the todoList it was dealing with.
 
Let's say you wanted to have multiple todoLists with one active at a time. Your state might look like this:
```
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
 ```
 This example uses the convention of dividing state into domain which reflects the data itself for a todoList and app which represents the workings of the application that manages the todoList.  We need to 'map' the set of actions to one particular instance of the lists array within domain and app.  This is done with a state map:
 
 ```
var stateMap = {
    app: ['app', 'lists', (action, state, list, index) => index == state.currentListIndex],
    domain: ['domain', 'lists', (action, state, list, index) => index == state.currentListIndex]
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
var initialState = {
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
 var stateMap1 = {
     app: ['app', 'list2'],
     domain: ['domain', 'list1']
 }
var stateMap1 = {
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
var todoList1 = connect(
    state => ({domain: {todoList: state.app.list1}, app: {todoList: state.app.list1),
    dispatch => ({actions: bindActionCreators(Reactions.actionGroup.list1)
);
var todoList2 = connect(
   state => ({domain: {todoList: state.app.list2}, app: {todoList: state.app.list2),
    dispatch => ({actions: bindActionCreators(Reactions.actionGroup.list1)
);
````
In effect what we have created is a structure for reducers and actions that is parallel to the mechanism you would normally use in connecting a component to state -- that is setting the state props to reflect just the part of the state relevant to the component instance.