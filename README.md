# Reactions
## Simplify Redux with Reactions
React and Redux make a powerful way to organize your state.  In their vanilla form you create actions which are dispatched by your components and then handled by reducer functions which ultimately render a new state with only the relevant state properties mutated.  You do this by writing:
* Actions
* Reducers
* Action types constants to bind the actions and reducers
* Selectors that provide data to components
* A hierarchy of reducers that walks through your state graph an delegates to individul reducers that provide new state values for your action.
* Glue code to wire all of this together and connect it to components

The goal of this project is to reduce the number of moving parts that you need.  This is done with *reactions* which contain:
* The action creator
* A declaration of what part of the state this action will modify
* A function that returns a new value for that part of the state
* Any selectors that components or actions may need to reference state

Reactions provides a master reducer that calls out to your reaction when it needs a new value for a part of the state that was effected by an action.  This means not having to create a hierarchy of reducers.  Reactions can be composed and connected to a component.  They can also be 'mapped' to a particular part of the state graph so they remain atomic.

## Usage

Add reactions to your project
```
npm install --save redux-redactions
```
```
import Reactions from 'redux-redactions'
```
> This is still a work in progress.  The author has incorporated it into a working react-native project and it is ready for others to use.  However it is likely that breaking changes will be needed as it is refined with more usage in real-world apps.


Define your Reactions.  Reactions are a combination of an action creator and a state declaration.  The state declaration defines the slice of the state being affected and a new value for that slice of the state:
```
const todoListReactions = {
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
import Reactions from 'redux-redactions';
Reactions.addReactions(todoListReactions);
```
Connect them to redux (you must include thunk):
```
const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
let initialState = {
    domain: {
        todoList: [
        ],
        nextId: 0
    },
    app: {filter: 'SHOW_ALL'}
};
const store = createStoreWithMiddleware(Reactions.reduce, initialState);
```
Dispatch them:
```
store.dispatch(Reactions.actions.AddItem("First Item"));
```
You can easily write tests for your reactions and ensure that not only do they do what you want them to do but that they don't mutate other parts of the state.  The stateChanges member function returns a string which describes which state slices have changed: 
```
        let oldState = state;
        store.dispatch(Reactions.actions.AddItem("First Item"));
        let state = store.getState();
        expect(state.domain.todoList.length).toEqual(1);
        expect(state.domain.todoList[0].text).toEqual("First Item");
        expect(state.domain.todoList[0].completed).toEqual(false);
        expect(state.domain.nextId).toEqual(1);
        expect(state.domain.todoList instanceof Array).toEqual(true);
        expect(Reactions.stateChanges(state, oldState)).toEqual('domain;domain.todoList;domain.nextId;app;');

```
## Anatomy of a Reaction
Each reaction is defined as a property where the property name is the action type:  
```
let todoList = {
    AddItem: {
```
The property contains further properties that
* returns an action creator:
```
        action:
            (idToToggle) => ({id: idToToggle}),
```
* defines the state slice that will be affected by the action and how that state will be changed: 
```
        state: [{
            slice: ['domain', 'todoList', (action, state, item) => action.id == item.id],
            assign:    (action, state, item) => ({completed: !item.completed})
        }]},
```
The state slice  defines the particular part of the state hierarchy that your reducer handler will effect as an array that describes the state hierarchy.  When an element in the heirarchy is an array or a hash you may specify a function that will be used to specify the particular element instance.  This function is called for every element and returns true to select that element.  It is passed:
 * the action
 * the top level state
 * the element itself,
 * the index of the element if the property is an array
  
  The state slice also defines the state handler which is a function that will either return a new value for the state element or an object to be merged with the existing state.  These types of state handlers are possible and specified by property key:
* **assign: (action, state, item)** - a function that will return properties to be merged into a copy of the state (similar to Object.assign) 
* **set: (action, state, item)** - a function returning a new value for that slice of the state
* **append: (action, state, item)** - a function returning a new value to be concatenated to this slice of the state which must be an array.  Similar to Array.concat.
* **insert: (action, state, item)** - a function returning an array where the first element is the position in the array at which the new value should be inserted and the second element is the value to be inserted. 
* **delete: true** - returns undefined for the new state.  Use for array elements which are to be deleted since any elements set to null or undefined will be removed from the array.

For assign, set and append you provide a function to provide a new value for that slice of that state.  That function is passed:
* **action** - the action object returned from the action function
* **state** - the root of the state heirarchy
* **item** - the particular slice of the state heirarchy as defined by the slice property

> Important: The state slice property must exist in the state for the state handler to get executed.  It is assumed that you will initialize your state with null or undefined values if there is no reason to have an actual value for a given property.

## State Composition

Although your reactions may be written to be aware of the entire state graph you might actually want to have them be independent of where they fit into the state graph of a large application.  For example you might have multiple todoLists and select a  'current one' or you might have several todoLists active at the same time.  In all cases your todoList reactions should be ignorant of these details and just manage a single todoList..
 
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
Now you need two state maps to map *app* and *domain* to the correct part of the overall state:
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
  Reactions.addReactions(todoListReactions, stateMap1, 'list1');
  Reactions.addReactions(todoListReactions, stateMap2, 'list2');
 ```
This will result in two sets of actions each of which has a different state map.  You can refer to them as:
```
    Reactions.actionGroup.list1.AddItem("First Item");
    Reactions.actionGroup.list2.AddItem("First Item");
````

##Usage With React
Once you have your reactions organized into groups there are several ways to connect them to a component.  Lets start with a basic one that still deals with multiple todoLists:
```
const mapStateToProps1 = state => ({todoList: state.domain.list1.todoList, filter: state.app.list1.filter});
const mapDispatchToProps1 = dispatch => (bindActionCreators(Reactions.actionGroup.list1));    
const todoList1 = connect(mapStateToProps1, dispatchToProps1)(TodoList);
```
```
const mapStateToProps2 = state => ({todoList: state.domain.list2.todoList, filter: state.app.list2.filter});
const mapDispatchToProps2 = dispatch => (bindActionCreators(Reactions.actionGroup.list2));    
const todoList2 = connect(mapStateToProps1, dispatchToProps1)(TodoList);
````
Now when either of the these components calls this.props.addItem() it will be referring to the correct todoList.  In effect what we have created is a mechanism for reducers and actions that is parallel to the mechanism for mapping state properties from just the relevant slice of the state map.

## Mapping a State Slice to Properties

Reactions.connect is a wrapper around react-redux's connect that maps reaction groups to a component.  It's primary benefit is providing a slice of the state defined in the state map associated with your group such that when you map state to properties you are mapping just that slice of the state to the properties. It also automatically maps the action creators in the group to properties as functions that will dispatch the action.

```
const mapStateToProps1 = state => ({todoList: state.domain.todoList, filter: state.app.filter});  
const todoList1 = Reactions.connect('list1', mapStateToProps1)(TodoList)
```
Here we have provided two properties, todoList and filter which will return the correct values for list1.  We have also mapped all of the reactions for list1 as properties as well.

## Selectors

Although you can certainly map individual state elements to properties using mapStateToProps, best practices suggest using selectors.  This gives you the possibility of using memoized selectors for better performance.  You can also group your selectors along with the reactions such that everything is one place.  Selectors are simply functions that given the state will return a value.

```
const todoListSelectors = {
    todoList: (state) => state.domain.todoList,
    filter: (state) => state.app.todoList,
    visibleTodos: (state) => (createSelector(
        [todoListSelector.todoList, todoListSelector.filter],
        (todos, filter) => {
            switch (filter) {
                case 'SHOW_ALL':
                    return todos
                case 'SHOW_COMPLETED':
                    return todos.filter(t => t.completed)
                case 'SHOW_ACTIVE':
                    return todos.filter(t => !t.completed)
            }
        }
    }
}

```
You can make the selectors part of a reactions group by composing them using an array: 
 ```
  Reactions.addReactions([todoListReactions, todoListSelectors], stateMap1, 'list1');
  Reactions.addReactions([todoListReactions, todoListSelectors], stateMap2, 'list2');
 ```
And when you connect this to react component it will connect the selectors to your property as well

```
let todoList1 = Reactions.connect('list1')(TodoList);
let todoList2 = Reactions.connect('list2')(TodoList);
```
### Using Selectors and Actions in Thunks

The final benefit of Reactions.connect is that it binds thinks with an additional first parameter which is the properties that are bound to the component via the Reactions.connect call.  This means that if you use thunks you can invoke actions and selectors easily:
```
bankReactions = {
    accountBalance: (state) => (state.domain.balance)
    withdraw: {
        action: (amount) => (props, dispatch, getState) => {
            if (amount > props.accountBalance) 
                props.overdraft(amount);
            else
                props.debit(amount);   
        }
    },
    overdraft: {.....}
    debit: {.....}
}
```

###Reactions.connect Usage
Reactions.connect is a pre-processor for redux connect that connects a reactions group to your component as well as fulfilling all of the other requirements of redux-react's connect. It provides these benefits:

* Maps all selectors in your reactions to props
* Maps all actions in your reactions to props as dispatchable functions invoked with *this* pointing to properties passed to the component (see next section on thunks)
* When using mapStateToProps it provides the slice of the state specified in the state map associated with the group.reaction actions as dispatchable functions Uses the state map to map your state to properties.

Your mapStateToProps function will override any selectors by the same name.
You also specify the mapActionToProps object or function and map the actions your self.  When using the function you are expected to provide action creators bound to dispatch.  If you also want the benefit of having props being passed to them as *this* you need to pass through *this* when binding them.  Reductions also exports it's own bindActionCreators which you can use in place of react-redux's bindActionCreators to facilitate in doing this.
### Reaction Composition with React

You can think of your reactions as chunks of business logic for your application. It consists of:
 * Actions to be performed that may be invoked both from components and from other actions. Actions either modify state or as thunks may call on other actions that do so.
 * The definition of how the state will be modified by an action if it does modify state.  It may modify one or more slices of the state.
 * Data that is to be consumed (selectors).  Selectors may be used either by your actions (simple action creators or thunks) or they may be consumed by components that connect to these reactions.
 
 Selectors and actions can be freely intermixed or composed.  Anywhere a reaction object is expected an array can be used to compose multiple reactions.  This let's you break up reactions into smaller files and then compose them into actual groups that you would add as reactions.  Reactions can depend on each other by composing your reactions and imported reactions using this mechanism.  For readability and modularity we recommend creating smaller reaction objects and composing them as needed.