import { Info } from "./Info";
import { AXGlobal } from "../../run/AXGlobal";
import { ScriptInfoState } from "../../run/ScriptInfoState";
import { ABCFile } from "./ABCFile";
import { Traits } from "./Traits";
import { MethodInfo } from "./MethodInfo";
import { IndentingWriter } from "@awayfl/swf-loader";

export class ScriptInfo extends Info {
    public global: AXGlobal = null;
	public state: ScriptInfoState = ScriptInfoState.None;
	private initialiser: MethodInfo;
    constructor(
      public abc: ABCFile,
      public initializer: number,
      public traits: Traits
    ) {
      super();
    }
  
    getInitializer(): MethodInfo {
	  if(this.initialiser) {
		  return this.initialiser;
	  }

	  this.initialiser = this.abc.getMethodInfo(this.initializer);
	  this.initialiser.scriptInfo = this;

	  return this.initialiser;
    }
  
    trace(writer: IndentingWriter) {
      writer.enter("ScriptInfo");
      this.traits.trace(writer);
      writer.outdent();
    }
  }