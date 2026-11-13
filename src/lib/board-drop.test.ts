import { describe, expect, it } from "vitest";
import { boardDrop, type BoardItem } from "./board-drop";
const items: BoardItem[] = [{ id:"a",status:"TODO",position:1 },{id:"b",status:"TODO",position:2},{id:"c",status:"TODO",position:3},{id:"d",status:"DOING",position:10}];
describe("board insertion",()=>{
 it("moves downward after target instead of snapping before it",()=>expect(boardDrop(items,"a","b",true)).toMatchObject({status:"TODO",index:1,position:2.5}));
 it("moves upward before target",()=>expect(boardDrop(items,"c","a",false)).toMatchObject({index:0,position:0}));
 it("does not write a no-op at its current slot",()=>expect(boardDrop(items,"a","b",false)).toBeNull());
 it("supports cross-column before and after target",()=>{expect(boardDrop(items,"a","d",false)).toMatchObject({status:"DOING",position:9});expect(boardDrop(items,"a","d",true)).toMatchObject({position:11});});
 it("supports empty column and dropping at end",()=>{expect(boardDrop(items,"a","col:DONE",false)).toMatchObject({status:"DONE",position:1});expect(boardDrop(items,"a","col:TODO",false)).toMatchObject({position:4});});
 it("rejects missing targets and self drops",()=>{expect(boardDrop(items,"a","a",false)).toBeNull();expect(boardDrop(items,"a","gone",false)).toBeNull();});
});
