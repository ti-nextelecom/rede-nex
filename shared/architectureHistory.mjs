export function createPlanState(project,dirty=false){return {project,past:[],future:[],change:dirty?1:0,savedChange:0};}
export function planReducer(state,action){
  if(action.type==='document'){
    if(action.document===state.project.document)return state;
    return {...state,project:{...state.project,document:action.document},past:[...state.past.slice(-39),state.project.document],future:[],change:state.change+1};
  }
  if(action.type==='meta')return {...state,project:{...state.project,...action.patch},change:state.change+1};
  if(action.type==='undo'&&state.past.length)return {...state,project:{...state.project,document:state.past.at(-1)},past:state.past.slice(0,-1),future:[state.project.document,...state.future],change:state.change+1};
  if(action.type==='redo'&&state.future.length)return {...state,project:{...state.project,document:state.future[0]},past:[...state.past.slice(-39),state.project.document],future:state.future.slice(1),change:state.change+1};
  if(action.type==='saved')return {...state,project:{...state.project,id:action.project.id,revision:action.project.revision,updated_at:action.project.updated_at},savedChange:action.change};
  return state;
}
