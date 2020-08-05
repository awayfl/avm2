/**
 * Compiler statistic
 */
interface ICompilerTask {
	name: string;
	start: number;
	droped: boolean;
}

interface ICompilerStat {
	runs: number;
	drops: number;
	minCompileTime: number;
	maxCompileTime: number;
	totalCompileTime: number;
	maxCompilerBatchTime: number;
	overhead: number;
}

export class Stat {
	public static TASK_DELAY = 10; // max delta between tasks
	public static readonly statRecords: ICompilerStat = {
		runs: 0,
		drops: 0,
		minCompileTime: Number.MAX_VALUE,
		maxCompileTime: -Number.MAX_VALUE,
		totalCompileTime: -0,
		maxCompilerBatchTime: -Number.MAX_VALUE,
		overhead: 0
	};

	private static _firstCompilerRun: number = -1;
	private static _lastCompilerStop: number = -1;

	private static _taskBathTime: number = 0;
	private static _currentTask: ICompilerTask;

	static begin(name: string) {
		const now = performance.now();
		this._currentTask = {
			name, 
			start: now, 
			droped: false, 
		}

		if(this._firstCompilerRun < 0) {
			this._firstCompilerRun = now;
		}
	}

	static drop() {
		if(!this._currentTask) {
			return;
		}

		this._currentTask.droped = true;
		this.end();
	}

	static end() {
		if(!this._currentTask) {
			return
		}

		const now = performance.now();
		const start = this._currentTask.start;
		const delta = now - start;
		const sr = this.statRecords;

		if(now - this._lastCompilerStop < this.TASK_DELAY) {
			this._taskBathTime += delta;
		} else {
			this._taskBathTime = 0;
		}

		sr.runs ++;
		sr.drops += +this._currentTask.droped;
		sr.totalCompileTime += delta;
		sr.minCompileTime = sr.minCompileTime > delta ? delta : sr.minCompileTime;
		sr.maxCompileTime = sr.minCompileTime < delta ? delta : sr.minCompileTime;
		sr.overhead = 100 * sr.totalCompileTime / (this._lastCompilerStop - this._firstCompilerRun);
	
		sr.maxCompilerBatchTime = 
			this._taskBathTime > sr.maxCompilerBatchTime 
			? this._taskBathTime 
			: sr.maxCompilerBatchTime;
		
		this._lastCompilerStop = now;
		this._currentTask = null;
	}

	static reset() {
		Object.assign(this.statRecords, {
			compiled: 0,
			droped: 0,
			minCompileTime: Number.MAX_VALUE,
			maxCompileTime: -Number.MAX_VALUE,
			totalCompileTime: -0,
			maxCompilerTaskTime: -Number.MAX_VALUE,
			overhead: 0
		})
		this._currentTask = null;
		this._taskBathTime = 0;
	}
}

//@ts-ignore
window.AWAY_COMPILER_STAT = Stat;