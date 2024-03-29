/*
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert, DataBuffer } from '@awayjs/graphics';

import { Multiname } from '../abc/lazy/Multiname';
import { checkValue  } from '../run/checkValue';
import { axCoerceName } from '../run/axCoerceName';
import { ASObject } from '../nat/ASObject';
import { release, notImplemented, unexpected, isNumeric, defineNonEnumerableProperty } from '@awayfl/swf-loader';
import { AMF0, AMF3 } from '../amf';
import { Bytecode } from '../abc/ops';
import { AXClass } from '../run/AXClass';

export enum AMFEncoding {
	AMF0 = 0,
	AMF3 = 3,
	DEFAULT = 3
}
export class ObjectEncoding extends ASObject {
	public static AMF0 = AMFEncoding.AMF0;
	public static AMF3 = AMFEncoding.AMF3;
	public static DEFAULT = AMFEncoding.DEFAULT;

	static get dynamicPropertyWriter(): any /* flash.net.IDynamicPropertyWriter */ {
		release || release || notImplemented('public ObjectEncoding::get dynamicPropertyWriter');
		return null;
	}

	static set dynamicPropertyWriter(value: any /* flash.net.IDynamicPropertyWriter */) {
		release || release || notImplemented('public ObjectEncoding::set dynamicPropertyWriter');
	}
}

export interface IDataInput {
	readBytes: (bytes: ByteArray, offset?: number /*uint*/, length?: number /*uint*/) => void;
	readBoolean: () => boolean;
	readByte: () => number /*int*/;
	readUnsignedByte: () => number /*uint*/;
	readShort: () => number /*int*/;
	readUnsignedShort: () => number /*uint*/;
	readInt: () => number /*int*/;
	readUnsignedInt: () => number /*uint*/;
	readFloat: () => number;
	readDouble: () => number;
	readMultiByte: (length: number /*uint*/, charSet: string) => string;
	readUTF: () => string;
	readUTFBytes: (length: number /*uint*/) => string;
	bytesAvailable: number /*uint*/;
	readObject: () => any;
	objectEncoding: number /*uint*/;
	endian: string;
}

export interface IDataOutput {
	writeBytes: (bytes: ByteArray, offset?: number /*uint*/, length?: number /*uint*/) => void;
	writeBoolean: (value: boolean) => void;
	writeByte: (value: number /*int*/) => void;
	writeShort: (value: number /*int*/) => void;
	writeInt: (value: number /*int*/) => void;
	writeUnsignedInt: (value: number /*uint*/) => void;
	writeFloat: (value: number) => void;
	writeDouble: (value: number) => void;
	writeMultiByte: (value: string, charSet: string) => void;
	writeUTF: (value: string) => void;
	writeUTFBytes: (value: string) => void;
	writeObject: (object: any) => void;
	objectEncoding: number /*uint*/;
	endian: string;
}

export class ByteArrayDataProvider {
	public static symbolForConstructor: any;
}
export class ByteArray extends ASObject implements IDataInput, IDataOutput {

	static axClass: typeof ByteArray & AXClass;

	public static classNatives: any [] = [DataBuffer];
	public static instanceNatives: any [] = [DataBuffer.prototype];

	static classInitializer() {
		const proto: any = DataBuffer.prototype;
		defineNonEnumerableProperty(proto, '$BgtoJSON', proto.toJSON);
	}

	_symbol: {
		buffer: Uint8Array;
		byteLength: number;
	};

	constructor(source?: any) {
		super();
		if (ByteArrayDataProvider.symbolForConstructor) {
			source = ByteArrayDataProvider.symbolForConstructor;
			ByteArrayDataProvider.symbolForConstructor = null;
		}
		let buffer: ArrayBuffer;
		let length = 0;
		if (source) {
			if (source instanceof ArrayBuffer) {
				buffer = source.slice(0);
			} else if (Array.isArray(source)) {
				buffer = new Uint8Array(source).buffer;
			} else if ('buffer' in source) {
				if (source.buffer instanceof ArrayBuffer) {
					buffer = new Uint8Array(source.buffer).buffer;
				} else if (source.buffer instanceof Uint8Array) {
					const begin = source.buffer.byteOffset;
					buffer = source.buffer.buffer.slice(begin, begin + source.buffer.length);
				} else {
					release || assert(source.buffer instanceof ArrayBuffer);
					buffer = source.buffer.slice();
				}
			} else {
				unexpected('Source type.');
			}
			length = buffer.byteLength;
		} else {
			buffer = new ArrayBuffer(ByteArray.INITIAL_SIZE);
		}
		this._buffer = buffer;
		this._length = length;
		this._position = 0;
		this._resetViews();
		this._objectEncoding = ByteArray.defaultObjectEncoding;
		this._littleEndian = false; // AS3 is bigEndian by default.
		this._bitBuffer = 0;
		this._bitLength = 0;
	}

	public setArrayBuffer(buffer: ArrayBuffer) {
		this._buffer = buffer;
		this._length = this._buffer.byteLength;
		this._resetViews();
	}

	/* The initial size of the backing, in bytes. Doubled every OOM. */
	private static INITIAL_SIZE = 128;

	private static _defaultObjectEncoding: number = ObjectEncoding.DEFAULT;

	static get defaultObjectEncoding(): number /*uint*/ {
		return this._defaultObjectEncoding;
	}

	static set defaultObjectEncoding(version: number /*uint*/) {
		version = version >>> 0;
		this._defaultObjectEncoding = version;
	}

	toJSON() {
		return 'ByteArray';
	}

	private _buffer: ArrayBuffer;
	private _length: number;
	private _position: number;
	private _littleEndian: boolean;
	private _objectEncoding: number;

	private _bitBuffer: number;
	private _bitLength: number;

	private _resetViews: () => void;

	readBytes: (bytes: ByteArray, offset?: number /*uint*/, length?: number /*uint*/) => void;
	readBoolean: () => boolean;
	readByte: () => number /*int*/;
	readUnsignedByte: () => number /*uint*/;
	readShort: () => number /*int*/;
	readUnsignedShort: () => number /*uint*/;
	readInt: () => number /*int*/;
	readUnsignedInt: () => number /*uint*/;
	readFloat: () => number;
	readDouble: () => number;
	readMultiByte: (length: number /*uint*/, charSet: string) => string;
	readUTF: () => string;
	readUTFBytes: (length: number /*uint*/) => string;
	bytesAvailable: number /*uint*/;
	readObject(): any {
		switch (this._objectEncoding) {
			case ObjectEncoding.AMF0:
				return AMF0.read(this);
			case ObjectEncoding.AMF3:
				return AMF3.read(this);
			default:
				unexpected('Object Encoding');
		}
	}

	writeBytes: (bytes: ByteArray, offset?: number /*uint*/, length?: number /*uint*/) => void;
	writeBoolean: (value: boolean) => void;
	writeByte: (value: number /*int*/) => void;
	writeShort: (value: number /*int*/) => void;
	writeInt: (value: number /*int*/) => void;
	writeUnsignedInt: (value: number /*uint*/) => void;
	writeFloat: (value: number) => void;
	writeDouble: (value: number) => void;
	writeMultiByte: (value: string, charSet: string) => void;
	writeUTF: (value: string) => void;
	writeUTFBytes: (value: string) => void;
	writeObject(object: any) {
		switch (this._objectEncoding) {
			case ObjectEncoding.AMF0:
				return AMF0.write(this, object);
			case ObjectEncoding.AMF3:
				return AMF3.write(this, object);
			default:
				unexpected('Object Encoding');
		}
	}

	getBytes: () => Uint8Array;

	objectEncoding: number /*uint*/;
	endian: string;

	readRawBytes: () => Int8Array;
	writeRawBytes: (bytes: Uint8Array) => void;
	position: number;
	length: number;

	axGetPublicProperty(nm: any): any {
		if (typeof nm === 'number' || isNumeric(nm = axCoerceName(nm))) {
			return this.axGetNumericProperty(nm);
		}
		return this['$Bg' + nm];
	}

	axGetNumericProperty(nm: number) {
		return (<any> this).getValue(nm);
	}

	axSetPublicProperty(nm: any, value: any) {
		release || checkValue(value);
		if (typeof nm === 'number' || isNumeric(nm = axCoerceName(nm))) {
			this.axSetNumericProperty(nm, value);
			return;
		}
		this['$Bg' + nm] = value;
	}

	axSetNumericProperty(nm: number, value: any) {
		(<any> this).setValue(nm, value);
	}

	axGetProperty(mn: Multiname): any {
		let name = mn.name;
		if (typeof name === 'number' || isNumeric(name = axCoerceName(name))) {
			release || assert(mn.isRuntimeName());
			return (<any> this).getValue(+name);
		}
		return super.axGetProperty(mn);
	}

	axSetProperty(mn: Multiname, value: any, bc: Bytecode): void {
		release || checkValue(value);
		let name = mn.name;
		if (typeof name === 'number' || isNumeric(name = axCoerceName(name))) {
			release || assert(mn.isRuntimeName());
			(<any> this).setValue(+name, value);
			return;
		}
		super.axSetProperty(mn, value, bc);
	}
}