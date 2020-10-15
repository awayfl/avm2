
export const enum COMPILATION_STATE {
	PENDING = 'pending',
	COMPILLED = 'compiled',
	FAILED = 'failed',
}

export const enum COMPILATION_FAIL_REASON {
	MANGLED_CLASSNAME = 'mangled_classname',
	UNDERRUN = 'underrun',
	TO_MANY_UNREACHED = 'to_many_unreached',
	UNKNOW_BYTECODE = 'unknow_bytecode',
	UNHANDLED_INSTRUCTION = 'unhandled_instruction',
}

export const enum COMPILER_OPT_FLAGS {
	USE_ES_PARAMS = 1, // use es7 style of compiled function to avoid use arguments
	USE_NEW_FUCTION = 2, // use eval instead of new Function
	SKIP_NULL_COERCE = 4, // skip coerce for nulled constant objects
	SKIP_DOMAIN_MEM = 8, // skip compilation of domain memory instructions
	ALLOW_CUSTOM_OPTIMISER = 16, // allow use custom optimiser classe for mutate codegenerator
	DEBUG_UNDERRUN = 32, // generate source code for methods with underrun for debuging
}

export const COMPILER_DEFAULT_OPT =
	COMPILER_OPT_FLAGS.ALLOW_CUSTOM_OPTIMISER |
	COMPILER_OPT_FLAGS.USE_NEW_FUCTION |
	COMPILER_OPT_FLAGS.USE_ES_PARAMS |
	COMPILER_OPT_FLAGS.SKIP_NULL_COERCE |
	COMPILER_OPT_FLAGS.SKIP_DOMAIN_MEM;
	//| COMPILER_OPT_FLAGS.DEBUG_UNDERRUN;