/*
* Copyright (c) 2006-2007 Erin Catto http://www.gphysics.com
*
* This software is provided 'as-is', without any express or implied
* warranty.  In no event will the authors be held liable for any damages
* arising from the use of this software.
* Permission is granted to anyone to use this software for any purpose,
* including commercial applications, and to alter it and redistribute it
* freely, subject to the following restrictions:
* 1. The origin of this software must not be misrepresented; you must not
* claim that you wrote the original software. If you use this software
* in a product, an acknowledgment in the product documentation would be
* appreciated but is not required.
* 2. Altered source versions must be plainly marked as such, and must not be
* misrepresented as being the original software.
* 3. This notice may not be removed or altered from any source distribution.
*/

import { b2Bound } from "./b2Bound";
import { b2Settings } from "../Common/b2Settings";
import { b2Pair } from "./b2Pair";
import { b2Proxy } from "./b2Proxy";
import { b2PairManager } from "./b2PairManager";
import { b2Vec2 } from "../Common/Math";
import { b2AABB } from "./b2AABB";
import { b2PairCallback } from "./b2PairCallback";
import { b2Math } from "../Common/Math";
import { b2BoundValues } from "./b2BoundValues";

/*
This broad phase uses the Sweep and Prune algorithm as described in:
Collision Detection in Interactive 3D Environments by Gino van den Bergen
Also, some ideas, such as using integral values for fast compares comes from
Bullet (http:/www.bulletphysics.com).
*/


// Notes:
// - we use bound arrays instead of linked lists for cache coherence.
// - we use quantized integral values for fast compares.
// - we use short indices rather than pointers to save memory.
// - we use a stabbing count for fast overlap queries (less than order N).
// - we also use a time stamp on each proxy to speed up the registration of
//   overlap query results.
// - where possible, we compare bound indices instead of values to reduce
//   cache misses (TODO_ERIN).
// - no broadphase is perfect and neither is this one: it is not great for huge
//   worlds (use a multi-SAP instead), it is not great for large objects.

export class b2BroadPhase
{
//public:
	constructor(worldAABB:b2AABB, callback:b2PairCallback){
		//b2Settings.b2Assert(worldAABB.IsValid());
		var i:number /** int */;
		
		this.m_pairManager.Initialize(this, callback);
		
		this.m_worldAABB = worldAABB;
		
		this.m_proxyCount = 0;
		
		// query results
		for (i = 0; i < b2Settings.b2_maxProxies; i++){
			this.m_queryResults[i] = 0;
		}
		
		// bounds array
		this.m_bounds = new Array(2);
		for (i = 0; i < 2; i++){
			this.m_bounds[i] = new Array(2*b2Settings.b2_maxProxies);
			for (var j:number /** int */ = 0; j < 2*b2Settings.b2_maxProxies; j++){
				this.m_bounds[i][j] = new b2Bound();
			}
		}
		
		//b2Vec2 d = worldAABB.upperBound - worldAABB.lowerBound;
		var dX:number = worldAABB.upperBound.x - worldAABB.lowerBound.x;;
		var dY:number = worldAABB.upperBound.y - worldAABB.lowerBound.y;
		
		this.m_quantizationFactor.x = b2Settings.USHRT_MAX / dX;
		this.m_quantizationFactor.y = b2Settings.USHRT_MAX / dY;
		
		var tProxy:b2Proxy;
		for (i = 0; i < b2Settings.b2_maxProxies - 1; ++i)
		{
			tProxy = new b2Proxy();
			this.m_proxyPool[i] = tProxy;
			tProxy.SetNext(i + 1);
			tProxy.timeStamp = 0;
			tProxy.overlapCount = b2BroadPhase.b2_invalid;
			tProxy.userData = null;
		}
		tProxy = new b2Proxy();
		this.m_proxyPool[b2Settings.b2_maxProxies-1] = tProxy;
		tProxy.SetNext(b2Pair.b2_nullProxy);
		tProxy.timeStamp = 0;
		tProxy.overlapCount = b2BroadPhase.b2_invalid;
		tProxy.userData = null;
		this.m_freeProxy = 0;
		
		this.m_timeStamp = 1;
		this.m_queryResultCount = 0;
	}
	//~b2BroadPhase();
	
	// Use this to see if your proxy is in range. If it is not in range,
	// it should be destroyed. Otherwise you may get O(m^2) pairs, where m
	// is the number of proxies that are out of range.
	public InRange(aabb:b2AABB):boolean{
		//b2Vec2 d = b2Max(aabb.lowerBound - this.m_worldAABB.upperBound, this.m_worldAABB.lowerBound - aabb.upperBound);
		var dX:number;
		var dY:number;
		var d2X:number;
		var d2Y:number;
		
		dX = aabb.lowerBound.x;
		dY = aabb.lowerBound.y;
		dX -= this.m_worldAABB.upperBound.x;
		dY -= this.m_worldAABB.upperBound.y;
		
		d2X = this.m_worldAABB.lowerBound.x;
		d2Y = this.m_worldAABB.lowerBound.y;
		d2X -= aabb.upperBound.x;
		d2Y -= aabb.upperBound.y;
		
		dX = b2Math.b2Max(dX, d2X);
		dY = b2Math.b2Max(dY, d2Y);
		
		return b2Math.b2Max(dX, dY) < 0.0;
	}
	
	// Get a single proxy. Returns NULL if the id is invalid.
	public GetProxy(proxyId:number /** int */):b2Proxy{
		var proxy: b2Proxy = this.m_proxyPool[proxyId];
		if (proxyId == b2Pair.b2_nullProxy || proxy.IsValid() == false)
		{
			return null;
		}
		
		return proxy;
	}

	// Create and destroy proxies. These call Flush first.
	public CreateProxy(aabb:b2AABB, userData:any):number /** uint */{
		var index:number /** uint */;
		var proxy:b2Proxy;
		
		//b2Settings.b2Assert(this.m_proxyCount < b2_maxProxies);
		//b2Settings.b2Assert(this.m_freeProxy != b2Pair.b2_nullProxy);
		
		var proxyId:number /** uint */ = this.m_freeProxy;
		proxy = this.m_proxyPool[ proxyId ];
		this.m_freeProxy = proxy.GetNext();
		
		proxy.overlapCount = 0;
		proxy.userData = userData;
		
		var boundCount:number /** uint */ = 2 * this.m_proxyCount;
		
		var lowerValues:number[] = [];
		var upperValues:number[] = [];
		this.ComputeBounds(lowerValues, upperValues, aabb);
		
		for (var axis:number /** int */ = 0; axis < 2; ++axis)
		{
			var bounds:b2Bound[] = this.m_bounds[axis];
			var lowerIndex:number /** uint */ = 0;
			var upperIndex:number /** uint */ = 0;
			var lowerIndexOut:number[] = [lowerIndex];
			var upperIndexOut:number[] = [upperIndex];
			this.Query(lowerIndexOut, upperIndexOut, lowerValues[axis], upperValues[axis], bounds, boundCount, axis);
			lowerIndex = lowerIndexOut[0];
			upperIndex = upperIndexOut[0];
			
			// Replace memmove calls
			//memmove(bounds + upperIndex + 2, bounds + upperIndex, (edgeCount - upperIndex) * sizeof(b2Bound));
			var tArr:b2Bound[] = [];
			var j:number /** int */;
			var tEnd:number /** int */ = boundCount - upperIndex
			var tBound1:b2Bound;
			var tBound2:b2Bound;
			var tBoundAS3:b2Bound;
			// make temp array
			for (j = 0; j < tEnd; j++){
				tArr[j] = new b2Bound();
				tBound1 = tArr[j];
				tBound2 = bounds[upperIndex+j];
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			// move temp array back in to bounds
			tEnd = tArr.length;
			var tIndex:number /** int */ = upperIndex+2;
			for (j = 0; j < tEnd; j++){
				//bounds[tIndex+j] = tArr[j];
				tBound2 = tArr[j];
				tBound1 = bounds[tIndex+j]
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			//memmove(bounds + lowerIndex + 1, bounds + lowerIndex, (upperIndex - lowerIndex) * sizeof(b2Bound));
			// make temp array
			tArr = new Array();
			tEnd = upperIndex - lowerIndex;
			for (j = 0; j < tEnd; j++){
				tArr[j] = new b2Bound();
				tBound1 = tArr[j];
				tBound2 = bounds[lowerIndex+j];
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			// move temp array back in to bounds
			tEnd = tArr.length;
			tIndex = lowerIndex+1;
			for (j = 0; j < tEnd; j++){
				//bounds[tIndex+j] = tArr[j];
				tBound2 = tArr[j];
				tBound1 = bounds[tIndex+j]
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			
			// The upper index has increased because of the lower bound insertion.
			++upperIndex;
			
			// Copy in the new bounds.
			tBound1 = bounds[lowerIndex];
			tBound2 = bounds[upperIndex];
			tBound1.value = lowerValues[axis];
			tBound1.proxyId = proxyId;
			tBound2.value = upperValues[axis];
			tBound2.proxyId = proxyId;
			
			tBoundAS3 = bounds[lowerIndex-1];
			tBound1.stabbingCount = lowerIndex == 0 ? 0 : tBoundAS3.stabbingCount;
			tBoundAS3 = bounds[upperIndex-1];
			tBound2.stabbingCount = tBoundAS3.stabbingCount;
			
			// Adjust the stabbing count between the new bounds.
			for (index = lowerIndex; index < upperIndex; ++index)
			{
				tBoundAS3 = bounds[index];
				tBoundAS3.stabbingCount++;
			}
			
			// Adjust the all the affected bound indices.
			for (index = lowerIndex; index < boundCount + 2; ++index)
			{
				tBound1 = bounds[index];
				var proxy2:b2Proxy = this.m_proxyPool[ tBound1.proxyId ];
				if (tBound1.IsLower())
				{
					proxy2.lowerBounds[axis] = index;
				}
				else
				{
					proxy2.upperBounds[axis] = index;
				}
			}
		}
		
		++this.m_proxyCount;
		
		//b2Settings.b2Assert(this.m_queryResultCount < b2Settings.b2_maxProxies);
		
		for (var i:number /** int */ = 0; i < this.m_queryResultCount; ++i)
		{
			//b2Settings.b2Assert(this.m_queryResults[i] < b2_maxProxies);
			//b2Settings.b2Assert(this.m_proxyPool[this.m_queryResults[i]].IsValid());
			
			this.m_pairManager.AddBufferedPair(proxyId, this.m_queryResults[i]);
		}
		
		this.m_pairManager.Commit();
		
		// Prepare for next query.
		this.m_queryResultCount = 0;
		this.IncrementTimeStamp();
		
		return proxyId;
	}
	
	public DestroyProxy(proxyId:number /** uint */) : void{
		var tBound1:b2Bound;
		var tBound2:b2Bound;
		
		//b2Settings.b2Assert(0 < this.m_proxyCount && this.m_proxyCount <= b2_maxProxies);
		
		var proxy:b2Proxy = this.m_proxyPool[ proxyId ];
		//b2Settings.b2Assert(proxy.IsValid());
		
		var boundCount:number /** int */ = 2 * this.m_proxyCount;
		
		for (var axis:number /** int */ = 0; axis < 2; ++axis)
		{
			var bounds:b2Bound[] = this.m_bounds[axis];
			
			var lowerIndex:number /** uint */ = proxy.lowerBounds[axis];
			var upperIndex:number /** uint */ = proxy.upperBounds[axis];
			tBound1 = bounds[lowerIndex];
			var lowerValue:number /** uint */ = tBound1.value;
			tBound2 = bounds[upperIndex];
			var upperValue:number /** uint */ = tBound2.value;
			
			// replace memmove calls
			//memmove(bounds + lowerIndex, bounds + lowerIndex + 1, (upperIndex - lowerIndex - 1) * sizeof(b2Bound));
			var tArr:b2Bound[] = new Array();
			var j:number /** int */;
			var tEnd:number /** int */ = upperIndex - lowerIndex - 1;
			// make temp array
			for (j = 0; j < tEnd; j++){
				tArr[j] = new b2Bound();
				tBound1 = tArr[j];
				tBound2 = bounds[lowerIndex+1+j];
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			// move temp array back in to bounds
			tEnd = tArr.length;
			var tIndex:number /** int */ = lowerIndex;
			for (j = 0; j < tEnd; j++){
				//bounds[tIndex+j] = tArr[j];
				tBound2 = tArr[j];
				tBound1 = bounds[tIndex+j]
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			//memmove(bounds + upperIndex-1, bounds + upperIndex + 1, (edgeCount - upperIndex - 1) * sizeof(b2Bound));
			// make temp array
			tArr = new Array();
			tEnd = boundCount - upperIndex - 1;
			for (j = 0; j < tEnd; j++){
				tArr[j] = new b2Bound();
				tBound1 = tArr[j];
				tBound2 = bounds[upperIndex+1+j];
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			// move temp array back in to bounds
			tEnd = tArr.length;
			tIndex = upperIndex-1;
			for (j = 0; j < tEnd; j++){
				//bounds[tIndex+j] = tArr[j];
				tBound2 = tArr[j];
				tBound1 = bounds[tIndex+j]
				tBound1.value = tBound2.value;
				tBound1.proxyId = tBound2.proxyId;
				tBound1.stabbingCount = tBound2.stabbingCount;
			}
			
			// Fix bound indices.
			tEnd = boundCount - 2;
			for (var index:number /** uint */ = lowerIndex; index < tEnd; ++index)
			{
				tBound1 = bounds[index];
				var proxy2:b2Proxy = this.m_proxyPool[ tBound1.proxyId ];
				if (tBound1.IsLower())
				{
					proxy2.lowerBounds[axis] = index;
				}
				else
				{
					proxy2.upperBounds[axis] = index;
				}
			}
			
			// Fix stabbing count.
			tEnd = upperIndex - 1;
			for (var index2:number /** int */ = lowerIndex; index2 < tEnd; ++index2)
			{
				tBound1 = bounds[index2];
				tBound1.stabbingCount--;
			}
			
			// Query for pairs to be removed. lowerIndex and upperIndex are not needed.
			// make lowerIndex and upper output using an array and do this for others if compiler doesn't pick them up
			this.Query([0], [0], lowerValue, upperValue, bounds, boundCount - 2, axis);
		}
		
		//b2Settings.b2Assert(this.m_queryResultCount < b2Settings.b2_maxProxies);
		
		for (var i:number /** int */ = 0; i < this.m_queryResultCount; ++i)
		{
			//b2Settings.b2Assert(this.m_proxyPool[this.m_queryResults[i]].IsValid());
			
			this.m_pairManager.RemoveBufferedPair(proxyId, this.m_queryResults[i]);
		}
		
		this.m_pairManager.Commit();
		
		// Prepare for next query.
		this.m_queryResultCount = 0;
		this.IncrementTimeStamp();
		
		// Return the proxy to the pool.
		proxy.userData = null;
		proxy.overlapCount = b2BroadPhase.b2_invalid;
		proxy.lowerBounds[0] = b2BroadPhase.b2_invalid;
		proxy.lowerBounds[1] = b2BroadPhase.b2_invalid;
		proxy.upperBounds[0] = b2BroadPhase.b2_invalid;
		proxy.upperBounds[1] = b2BroadPhase.b2_invalid;
		
		proxy.SetNext(this.m_freeProxy);
		this.m_freeProxy = proxyId;
		--this.m_proxyCount;
	}


	// Call MoveProxy as many times as you like, then when you are done
	// call Commit to finalized the proxy pairs (for your time step).
	public MoveProxy(proxyId:number /** uint */, aabb:b2AABB) : void{
		var as3arr: number[];
		var as3int: number /** int */;
		
		var axis:number /** uint */;
		var index:number /** uint */;
		var bound:b2Bound;
		var prevBound:b2Bound;
		var nextBound:b2Bound;
		var nextProxyId:number /** uint */;
		var nextProxy:b2Proxy;
		
		if (proxyId == b2Pair.b2_nullProxy || b2Settings.b2_maxProxies <= proxyId)
		{
			//b2Settings.b2Assert(false);
			return;
		}
		
		if (aabb.IsValid() == false)
		{
			//b2Settings.b2Assert(false);
			return;
		}
		
		var boundCount:number /** uint */ = 2 * this.m_proxyCount;
		
		var proxy:b2Proxy = this.m_proxyPool[ proxyId ];
		// Get new bound values
		var newValues:b2BoundValues = new b2BoundValues();
		this.ComputeBounds(newValues.lowerValues, newValues.upperValues, aabb);
		
		// Get old bound values
		var oldValues:b2BoundValues = new b2BoundValues();
		for (axis = 0; axis < 2; ++axis)
		{
			bound = this.m_bounds[axis][proxy.lowerBounds[axis]];
			oldValues.lowerValues[axis] = bound.value;
			bound = this.m_bounds[axis][proxy.upperBounds[axis]];
			oldValues.upperValues[axis] = bound.value;
		}
		
		for (axis = 0; axis < 2; ++axis)
		{
			var bounds:b2Bound[] = this.m_bounds[axis];
			
			var lowerIndex:number /** uint */ = proxy.lowerBounds[axis];
			var upperIndex:number /** uint */ = proxy.upperBounds[axis];
			
			var lowerValue:number /** uint */ = newValues.lowerValues[axis];
			var upperValue:number /** uint */ = newValues.upperValues[axis];
			
			bound = bounds[lowerIndex];
			var deltaLower:number /** int */ = lowerValue - bound.value;
			bound.value = lowerValue;
			
			bound = bounds[upperIndex];
			var deltaUpper:number /** int */ = upperValue - bound.value;
			bound.value = upperValue;
			
			//
			// Expanding adds overlaps
			//
			
			// Should we move the lower bound down?
			if (deltaLower < 0)
			{
				index = lowerIndex;
				while (index > 0 && lowerValue < (bounds[index-1] as b2Bound).value)
				{
					bound = bounds[index];
					prevBound = bounds[index - 1];
					
					var prevProxyId:number /** uint */ = prevBound.proxyId;
					var prevProxy:b2Proxy = this.m_proxyPool[ prevBound.proxyId ];
					
					prevBound.stabbingCount++;
					
					if (prevBound.IsUpper() == true)
					{
						if (this.TestOverlap(newValues, prevProxy))
						{
							this.m_pairManager.AddBufferedPair(proxyId, prevProxyId);
						}
						
						//prevProxy.upperBounds[axis]++;
						as3arr = prevProxy.upperBounds;
						as3int = as3arr[axis];
						as3int++;
						as3arr[axis] = as3int;
						
						bound.stabbingCount++;
					}
					else
					{
						//prevProxy.lowerBounds[axis]++;
						as3arr = prevProxy.lowerBounds;
						as3int = as3arr[axis];
						as3int++;
						as3arr[axis] = as3int;
						
						bound.stabbingCount--;
					}
					
					//proxy.lowerBounds[axis]--;
					as3arr = proxy.lowerBounds;
					as3int = as3arr[axis];
					as3int--;
					as3arr[axis] = as3int;
					
					// swap
					//var temp:b2Bound = bound;
					//bound = prevEdge;
					//prevEdge = temp;
					bound.Swap(prevBound);
					//b2Math.b2Swap(bound, prevEdge);
					--index;
				}
			}
			
			// Should we move the upper bound up?
			if (deltaUpper > 0)
			{
				index = upperIndex;
				while (index < boundCount-1 && (bounds[index+1] as b2Bound).value <= upperValue)
				{
					bound = bounds[ index ];
					nextBound = bounds[ index + 1 ];
					nextProxyId = nextBound.proxyId;
					nextProxy = this.m_proxyPool[ nextProxyId ];
					
					nextBound.stabbingCount++;
					
					if (nextBound.IsLower() == true)
					{
						if (this.TestOverlap(newValues, nextProxy))
						{
							this.m_pairManager.AddBufferedPair(proxyId, nextProxyId);
						}
						
						//nextProxy.lowerBounds[axis]--;
						as3arr = nextProxy.lowerBounds;
						as3int = as3arr[axis];
						as3int--;
						as3arr[axis] = as3int;
						
						bound.stabbingCount++;
					}
					else
					{
						//nextProxy.upperBounds[axis]--;
						as3arr = nextProxy.upperBounds;
						as3int = as3arr[axis];
						as3int--;
						as3arr[axis] = as3int;
						
						bound.stabbingCount--;
					}
					
					//proxy.upperBounds[axis]++;
					as3arr = proxy.upperBounds;
					as3int = as3arr[axis];
					as3int++;
					as3arr[axis] = as3int;
					
					// swap
					//var temp:b2Bound = bound;
					//bound = nextEdge;
					//nextEdge = temp;
					bound.Swap(nextBound);
					//b2Math.b2Swap(bound, nextEdge);
					index++;
				}
			}
			
			//
			// Shrinking removes overlaps
			//
			
			// Should we move the lower bound up?
			if (deltaLower > 0)
			{
				index = lowerIndex;
				while (index < boundCount-1 && (bounds[index+1] as b2Bound).value <= lowerValue)
				{
					bound = bounds[ index ];
					nextBound = bounds[ index + 1 ];
					
					nextProxyId = nextBound.proxyId;
					nextProxy = this.m_proxyPool[ nextProxyId ];
					
					nextBound.stabbingCount--;
					
					if (nextBound.IsUpper())
					{
						if (this.TestOverlap(oldValues, nextProxy))
						{
							this.m_pairManager.RemoveBufferedPair(proxyId, nextProxyId);
						}
						
						//nextProxy.upperBounds[axis]--;
						as3arr = nextProxy.upperBounds;
						as3int = as3arr[axis];
						as3int--;
						as3arr[axis] = as3int;
						
						bound.stabbingCount--;
					}
					else
					{
						//nextProxy.lowerBounds[axis]--;
						as3arr = nextProxy.lowerBounds;
						as3int = as3arr[axis];
						as3int--;
						as3arr[axis] = as3int;
						
						bound.stabbingCount++;
					}
					
					//proxy.lowerBounds[axis]++;
					as3arr = proxy.lowerBounds;
					as3int = as3arr[axis];
					as3int++;
					as3arr[axis] = as3int;
					
					// swap
					//var temp:b2Bound = bound;
					//bound = nextEdge;
					//nextEdge = temp;
					bound.Swap(nextBound);
					//b2Math.b2Swap(bound, nextEdge);
					index++;
				}
			}
			
			// Should we move the upper bound down?
			if (deltaUpper < 0)
			{
				index = upperIndex;
				while (index > 0 && upperValue < (bounds[index-1] as b2Bound).value)
				{
					bound = bounds[index];
					prevBound = bounds[index - 1];
					
					prevProxyId = prevBound.proxyId;
					prevProxy = this.m_proxyPool[ prevProxyId ];
					
					prevBound.stabbingCount--;
					
					if (prevBound.IsLower() == true)
					{
						if (this.TestOverlap(oldValues, prevProxy))
						{
							this.m_pairManager.RemoveBufferedPair(proxyId, prevProxyId);
						}
						
						//prevProxy.lowerBounds[axis]++;
						as3arr = prevProxy.lowerBounds;
						as3int = as3arr[axis];
						as3int++;
						as3arr[axis] = as3int;
						
						bound.stabbingCount--;
					}
					else
					{
						//prevProxy.upperBounds[axis]++;
						as3arr = prevProxy.upperBounds;
						as3int = as3arr[axis];
						as3int++;
						as3arr[axis] = as3int;
						
						bound.stabbingCount++;
					}
					
					//proxy.upperBounds[axis]--;
					as3arr = proxy.upperBounds;
					as3int = as3arr[axis];
					as3int--;
					as3arr[axis] = as3int;
					
					// swap
					//var temp:b2Bound = bound;
					//bound = prevEdge;
					//prevEdge = temp;
					bound.Swap(prevBound);
					//b2Math.b2Swap(bound, prevEdge);
					index--;
				}
			}
		}
	}
	
	public Commit() : void{
		this.m_pairManager.Commit();
	}

	// Query an AABB for overlapping proxies, returns the user data and
	// the count, up to the supplied maximum count.
	public QueryAABB(aabb:b2AABB, userData:any, maxCount:number /** int */):number /** int */{
		var lowerValues:number[] = new Array();
		var upperValues:number[] = new Array();
		this.ComputeBounds(lowerValues, upperValues, aabb);
		
		var lowerIndex:number /** uint */ = 0;
		var upperIndex:number /** uint */ = 0;
		var lowerIndexOut:number[] = [lowerIndex];
		var upperIndexOut:number[] = [upperIndex];
		this.Query(lowerIndexOut, upperIndexOut, lowerValues[0], upperValues[0], this.m_bounds[0], 2*this.m_proxyCount, 0);
		this.Query(lowerIndexOut, upperIndexOut, lowerValues[1], upperValues[1], this.m_bounds[1], 2*this.m_proxyCount, 1);
		
		//b2Settings.b2Assert(this.m_queryResultCount < b2Settings.b2_maxProxies);
		
		var count:number /** int */ = 0;
		for (var i:number /** int */ = 0; i < this.m_queryResultCount && count < maxCount; ++i, ++count)
		{
			//b2Settings.b2Assert(this.m_queryResults[i] < b2Settings.b2_maxProxies);
			var proxy:b2Proxy = this.m_proxyPool[ this.m_queryResults[i] ];
			//b2Settings.b2Assert(proxy.IsValid());
			userData[i] = proxy.userData;
		}
		
		// Prepare for next query.
		this.m_queryResultCount = 0;
		this.IncrementTimeStamp();
		
		return count;
	}

	public Validate() : void{
		var pair:b2Pair;
		var proxy1:b2Proxy;
		var proxy2:b2Proxy;
		var overlap:boolean;
		
		for (var axis:number /** int */ = 0; axis < 2; ++axis)
		{
			var bounds:b2Bound[] = this.m_bounds[axis];
			
			var boundCount:number /** uint */ = 2 * this.m_proxyCount;
			var stabbingCount:number /** uint */ = 0;
			
			for (var i:number /** uint */ = 0; i < boundCount; ++i)
			{
				var bound:b2Bound = bounds[i];
				//b2Settings.b2Assert(i == 0 || bounds[i-1].value <= bound->value);
				//b2Settings.b2Assert(bound->proxyId != b2_nullProxy);
				//b2Settings.b2Assert(this.m_proxyPool[bound->proxyId].IsValid());
				
				if (bound.IsLower() == true)
				{
					//b2Settings.b2Assert(this.m_proxyPool[bound.proxyId].lowerBounds[axis] == i);
					stabbingCount++;
				}
				else
				{
					//b2Settings.b2Assert(this.m_proxyPool[bound.proxyId].upperBounds[axis] == i);
					stabbingCount--;
				}
				
				//b2Settings.b2Assert(bound.stabbingCount == stabbingCount);
			}
		}
		
	}

//private:
	private ComputeBounds(lowerValues:number[], upperValues:number[], aabb:b2AABB) : void
	{
		//b2Settings.b2Assert(aabb.upperBound.x > aabb.lowerBound.x);
		//b2Settings.b2Assert(aabb.upperBound.y > aabb.lowerBound.y);
		
		//var minVertex:b2Vec2 = b2Math.b2ClampV(aabb.minVertex, this.m_worldAABB.minVertex, this.m_worldAABB.maxVertex);
		var minVertexX:number = aabb.lowerBound.x;
		var minVertexY:number = aabb.lowerBound.y;
		minVertexX = b2Math.b2Min(minVertexX, this.m_worldAABB.upperBound.x);
		minVertexY = b2Math.b2Min(minVertexY, this.m_worldAABB.upperBound.y);
		minVertexX = b2Math.b2Max(minVertexX, this.m_worldAABB.lowerBound.x);
		minVertexY = b2Math.b2Max(minVertexY, this.m_worldAABB.lowerBound.y);
		
		//var maxVertex:b2Vec2 = b2Math.b2ClampV(aabb.maxVertex, this.m_worldAABB.minVertex, this.m_worldAABB.maxVertex);
		var maxVertexX:number = aabb.upperBound.x;
		var maxVertexY:number = aabb.upperBound.y;
		maxVertexX = b2Math.b2Min(maxVertexX, this.m_worldAABB.upperBound.x);
		maxVertexY = b2Math.b2Min(maxVertexY, this.m_worldAABB.upperBound.y);
		maxVertexX = b2Math.b2Max(maxVertexX, this.m_worldAABB.lowerBound.x);
		maxVertexY = b2Math.b2Max(maxVertexY, this.m_worldAABB.lowerBound.y);
		
		// Bump lower bounds downs and upper bounds up. This ensures correct sorting of
		// lower/upper bounds that would have equal values.
		// TODO_ERIN implement fast float to uint16 conversion.
		lowerValues[0] = ((this.m_quantizationFactor.x * (minVertexX - this.m_worldAABB.lowerBound.x)) >>> 0) & (b2Settings.USHRT_MAX - 1);
		upperValues[0] = (((this.m_quantizationFactor.x * (maxVertexX - this.m_worldAABB.lowerBound.x)) >>> 0) & 0x0000ffff) | 1;
		
		lowerValues[1] = ((this.m_quantizationFactor.y * (minVertexY - this.m_worldAABB.lowerBound.y)) >>> 0) & (b2Settings.USHRT_MAX - 1);
		upperValues[1] = (((this.m_quantizationFactor.y * (maxVertexY - this.m_worldAABB.lowerBound.y)) >>> 0) & 0x0000ffff) | 1;
	}

	// This one is only used for validation.
	private TestOverlapValidate(p1:b2Proxy, p2:b2Proxy):boolean{
		
		for (var axis:number /** int */ = 0; axis < 2; ++axis)
		{
			var bounds:b2Bound[] = this.m_bounds[axis];
			
			//b2Settings.b2Assert(p1.lowerBounds[axis] < 2 * this.m_proxyCount);
			//b2Settings.b2Assert(p1.upperBounds[axis] < 2 * this.m_proxyCount);
			//b2Settings.b2Assert(p2.lowerBounds[axis] < 2 * this.m_proxyCount);
			//b2Settings.b2Assert(p2.upperBounds[axis] < 2 * this.m_proxyCount);
			
			var bound1:b2Bound = bounds[p1.lowerBounds[axis]];
			var bound2:b2Bound = bounds[p2.upperBounds[axis]];
			if (bound1.value > bound2.value)
				return false;
			
			bound1 = bounds[p1.upperBounds[axis]];
			bound2 = bounds[p2.lowerBounds[axis]];
			if (bound1.value < bound2.value)
				return false;
		}
		
		return true;
	}
	
	public TestOverlap(b:b2BoundValues, p:b2Proxy):boolean
	{
		for (var axis:number /** int */ = 0; axis < 2; ++axis)
		{
			var bounds:b2Bound[] = this.m_bounds[axis];
			
			//b2Settings.b2Assert(p.lowerBounds[axis] < 2 * this.m_proxyCount);
			//b2Settings.b2Assert(p.upperBounds[axis] < 2 * this.m_proxyCount);
			
			var bound:b2Bound = bounds[p.upperBounds[axis]];
			if (b.lowerValues[axis] > bound.value)
				return false;
			
			bound = bounds[p.lowerBounds[axis]];
			if (b.upperValues[axis] < bound.value)
				return false;
		}
		
		return true;
	}

	private Query(lowerQueryOut:number[], upperQueryOut:number[], lowerValue:number /** uint */, upperValue:number /** uint */, bounds:b2Bound[], boundCount:number /** uint */, axis:number /** int */) : void{
		
		var lowerQuery:number /** uint */ = b2BroadPhase.BinarySearch(bounds, boundCount, lowerValue);
		var upperQuery:number /** uint */ = b2BroadPhase.BinarySearch(bounds, boundCount, upperValue);
		var bound: b2Bound;
		
		// Easy case: lowerQuery <= lowerIndex(i) < upperQuery
		// Solution: search query range for min bounds.
		for (var j:number /** uint */ = lowerQuery; j < upperQuery; ++j)
		{
			bound = bounds[j];
			if (bound.IsLower())
			{
				this.IncrementOverlapCount(bound.proxyId);
			}
		}
		
		// Hard case: lowerIndex(i) < lowerQuery < upperIndex(i)
		// Solution: use the stabbing count to search down the bound array.
		if (lowerQuery > 0)
		{
			var i:number /** int */ = lowerQuery - 1;
			bound = bounds[i];
			var s:number /** int */ = bound.stabbingCount;
			
			// Find the s overlaps.
			while (s)
			{
				//b2Settings.b2Assert(i >= 0);
				bound = bounds[i];
				if (bound.IsLower())
				{
					var proxy:b2Proxy = this.m_proxyPool[ bound.proxyId ];
					if (lowerQuery <= proxy.upperBounds[axis])
					{
						this.IncrementOverlapCount(bound.proxyId);
						--s;
					}
				}
				--i;
			}
		}
		
		lowerQueryOut[0] = lowerQuery;
		upperQueryOut[0] = upperQuery;
	}


	private IncrementOverlapCount(proxyId:number /** uint */) : void{
		var proxy:b2Proxy = this.m_proxyPool[ proxyId ];
		if (proxy.timeStamp < this.m_timeStamp)
		{
			proxy.timeStamp = this.m_timeStamp;
			proxy.overlapCount = 1;
		}
		else
		{
			proxy.overlapCount = 2;
			//b2Settings.b2Assert(this.m_queryResultCount < b2Settings.b2_maxProxies);
			this.m_queryResults[this.m_queryResultCount] = proxyId;
			++this.m_queryResultCount;
		}
	}
	private IncrementTimeStamp() : void{
		if (this.m_timeStamp == b2Settings.USHRT_MAX)
		{
			for (var i:number /** uint */ = 0; i < b2Settings.b2_maxProxies; ++i)
			{
				(this.m_proxyPool[i] as b2Proxy).timeStamp = 0;
			}
			this.m_timeStamp = 1;
		}
		else
		{
			++this.m_timeStamp;
		}
	}

//public:
	public m_pairManager:b2PairManager = new b2PairManager();

	public m_proxyPool:b2Proxy[] = new Array(b2Settings.b2_maxPairs);
	public m_freeProxy:number /** uint */;

	public m_bounds:b2Bound[][] = new Array(2*b2Settings.b2_maxProxies);

	public m_queryResults:number[] = new Array(b2Settings.b2_maxProxies);
	public m_queryResultCount:number /** int */;

	public m_worldAABB:b2AABB;
	public m_quantizationFactor:b2Vec2 = new b2Vec2();
	public m_proxyCount:number /** int */;
	public m_timeStamp:number /** uint */;

	public static s_validate:boolean = false;
	
	public static readonly b2_invalid:number /** uint */ = b2Settings.USHRT_MAX;
	public static readonly b2_nullEdge:number /** uint */ = b2Settings.USHRT_MAX;


	public static BinarySearch(bounds:b2Bound[], count:number /** int */, value:number /** uint */):number /** uint */
	{
		var low:number /** int */ = 0;
		var high:number /** int */ = count - 1;
		while (low <= high)
		{
			var mid:number /** int */ = ((low + high) / 2)|0;
			var bound:b2Bound = bounds[mid];
			if (bound.value > value)
			{
				high = mid - 1;
			}
			else if (bound.value < value)
			{
				low = mid + 1;
			}
			else
			{
				return mid >>> 0;
			}
		}
		
		return low >>> 0;
	}
	
	
}