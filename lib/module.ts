/*
 * Copyright 2013 Mozilla Foundation
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
'use strict';

export const timelineBuffer = null;
//export var timelineBuffer = Shumway.Tools ? new TimelineBuffer("AVX") : null;
export const counter = null;//new Counter(!release);
const profile = false;
export function countTimeline(name: string, value: number = 1) {
	timelineBuffer && timelineBuffer.count(name, value);
}

export function enterTimeline(name: string, data?: any) {
	profile && timelineBuffer && timelineBuffer.enter(name, data);
}

export function leaveTimeline(data?: any) {
	profile && timelineBuffer && timelineBuffer.leave(null, data);
}
