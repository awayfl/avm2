import { b2SimplexCache } from "./b2SimplexCache";
import { b2DistanceProxy } from "./b2DistanceProxy";
import { b2Transform, b2Vec2, b2Mat22, b2Math } from "../Common/Math";
import { b2Settings } from "../Common/b2Settings";

export class b2SeparationFunction
{
	//enum Type
	public static readonly e_points:number /** int */ = 0x01;
	public static readonly e_faceA:number /** int */ = 0x02;
	public static readonly e_faceB:number /** int */ = 0x04;
	
	public Initialize(cache:b2SimplexCache,
								proxyA:b2DistanceProxy, transformA:b2Transform,
								proxyB:b2DistanceProxy, transformB:b2Transform):void
	{
		this.m_proxyA = proxyA;
		this.m_proxyB = proxyB;
		var count:number /** int */ = cache.count;
		b2Settings.b2Assert(0 < count && count < 3);
		
		var localPointA:b2Vec2;
		var localPointA1:b2Vec2;
		var localPointA2:b2Vec2;
		var localPointB:b2Vec2;
		var localPointB1:b2Vec2;
		var localPointB2:b2Vec2;
		var pointAX:number;
		var pointAY:number;
		var pointBX:number;
		var pointBY:number;
		var normalX:number;
		var normalY:number;
		var tMat:b2Mat22;
		var tVec:b2Vec2;
		var s:number;
		var sgn:number;
		
		if (count == 1)
		{
			this.m_type = b2SeparationFunction.e_points;
			localPointA = this.m_proxyA.GetVertex(cache.indexA[0]);
			localPointB = this.m_proxyB.GetVertex(cache.indexB[0]);
			//pointA = b2Math.b2MulX(transformA, localPointA);
			tVec = localPointA;
			tMat = transformA.R;
			pointAX = transformA.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y)
			pointAY = transformA.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y)
			//pointB = b2Math.b2MulX(transformB, localPointB);
			tVec = localPointB;
			tMat = transformB.R;
			pointBX = transformB.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y)
			pointBY = transformB.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y)
			//m_axis = b2Math.SubtractVV(pointB, pointA);
			this.m_axis.x = pointBX - pointAX;
			this.m_axis.y = pointBY - pointAY;
			this.m_axis.Normalize();
		}
		else if (cache.indexB[0] == cache.indexB[1])
		{
			// Two points on A and one on B
			this.m_type = b2SeparationFunction.e_faceA;
			localPointA1 = this.m_proxyA.GetVertex(cache.indexA[0]);
			localPointA2 = this.m_proxyA.GetVertex(cache.indexA[1]);
			localPointB = this.m_proxyB.GetVertex(cache.indexB[0]);
			this.m_localPoint.x = 0.5 * (localPointA1.x + localPointA2.x);
			this.m_localPoint.y = 0.5 * (localPointA1.y + localPointA2.y);
			this.m_axis = b2Math.CrossVF(b2Math.SubtractVV(localPointA2, localPointA1), 1.0);
			this.m_axis.Normalize();
			
			//normal = b2Math.b2MulMV(transformA.R, this.m_axis);
			tVec = this.m_axis;
			tMat = transformA.R;
			normalX = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
			normalY = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
			//pointA = b2Math.b2MulX(transformA, this.m_localPoint);
			tVec = this.m_localPoint;
			tMat = transformA.R;
			pointAX = transformA.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
			pointAY = transformA.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
			//pointB = b2Math.b2MulX(transformB, localPointB);
			tVec = localPointB;
			tMat = transformB.R;
			pointBX = transformB.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
			pointBY = transformB.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
			
			//float32 s = b2Dot(pointB - pointA, normal);
			s = (pointBX - pointAX) * normalX + (pointBY - pointAY) * normalY;
			if (s < 0.0)
			{
				this.m_axis.NegativeSelf();
			}
		}
		else if (cache.indexA[0] == cache.indexA[0])
		{
			// Two points on B and one on A
			this.m_type = b2SeparationFunction.e_faceB;
			localPointB1 = this.m_proxyB.GetVertex(cache.indexB[0]);
			localPointB2 = this.m_proxyB.GetVertex(cache.indexB[1]);
			localPointA = this.m_proxyA.GetVertex(cache.indexA[0]);
			this.m_localPoint.x = 0.5 * (localPointB1.x + localPointB2.x);
			this.m_localPoint.y = 0.5 * (localPointB1.y + localPointB2.y);
			this.m_axis = b2Math.CrossVF(b2Math.SubtractVV(localPointB2, localPointB1), 1.0);
			this.m_axis.Normalize();
			
			//normal = b2Math.b2MulMV(transformB.R, this.m_axis);
			tVec = this.m_axis;
			tMat = transformB.R;
			normalX = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
			normalY = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
			//pointB = b2Math.b2MulX(transformB, this.m_localPoint);
			tVec = this.m_localPoint;
			tMat = transformB.R;
			pointBX = transformB.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
			pointBY = transformB.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
			//pointA = b2Math.b2MulX(transformA, localPointA);
			tVec = localPointA;
			tMat = transformA.R;
			pointAX = transformA.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
			pointAY = transformA.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
			
			//float32 s = b2Dot(pointA - pointB, normal);
			s = (pointAX - pointBX) * normalX + (pointAY - pointBY) * normalY;
			if (s < 0.0)
			{
				this.m_axis.NegativeSelf();
			}
		}
		else
		{
			// Two points on B and two points on A.
			// The faces are parallel.
			localPointA1 = this.m_proxyA.GetVertex(cache.indexA[0]);
			localPointA2 = this.m_proxyA.GetVertex(cache.indexA[1]);
			localPointB1 = this.m_proxyB.GetVertex(cache.indexB[0]);
			localPointB2 = this.m_proxyB.GetVertex(cache.indexB[1]);
			
			var pA:b2Vec2 = b2Math.MulX(transformA, localPointA);
			var dA:b2Vec2 = b2Math.MulMV(transformA.R, b2Math.SubtractVV(localPointA2, localPointA1));
			var pB:b2Vec2 = b2Math.MulX(transformB, localPointB);
			var dB:b2Vec2 = b2Math.MulMV(transformB.R, b2Math.SubtractVV(localPointB2, localPointB1));
			
			var a:number = dA.x * dA.x + dA.y * dA.y;
			var e:number = dB.x * dB.x + dB.y * dB.y;
			var r:b2Vec2 = b2Math.SubtractVV(dB, dA);
			var c:number = dA.x * r.x + dA.y * r.y;
			var f:number = dB.x * r.x + dB.y * r.y;
			
			var b:number = dA.x * dB.x + dA.y * dB.y;
			var denom:number = a * e-b * b;
			
			s = 0.0;
			if (denom != 0.0)
			{
				s = b2Math.Clamp((b * f - c * e) / denom, 0.0, 1.0);
			}
			
			var t:number = (b * s + f) / e;
			if (t < 0.0)
			{
				t = 0.0;
				s = b2Math.Clamp((b - c) / a, 0.0, 1.0);
			}
			
			//b2Vec2 localPointA = localPointA1 + s * (localPointA2 - localPointA1);
			localPointA = new b2Vec2();
			localPointA.x = localPointA1.x + s * (localPointA2.x - localPointA1.x);
			localPointA.y = localPointA1.y + s * (localPointA2.y - localPointA1.y);
			//b2Vec2 localPointB = localPointB1 + s * (localPointB2 - localPointB1);
			localPointB = new b2Vec2();
			localPointB.x = localPointB1.x + s * (localPointB2.x - localPointB1.x);
			localPointB.y = localPointB1.y + s * (localPointB2.y - localPointB1.y);
			
			if (s == 0.0 || s == 1.0)
			{
				this.m_type = b2SeparationFunction.e_faceB;
				this.m_axis = b2Math.CrossVF(b2Math.SubtractVV(localPointB2, localPointB1), 1.0);
				this.m_axis.Normalize();
                
				this.m_localPoint = localPointB;
				
				//normal = b2Math.b2MulMV(transformB.R, this.m_axis);
				tVec = this.m_axis;
				tMat = transformB.R;
				normalX = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
				normalY = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
				//pointB = b2Math.b2MulX(transformB, this.m_localPoint);
				tVec = this.m_localPoint;
				tMat = transformB.R;
				pointBX = transformB.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
				pointBY = transformB.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
				//pointA = b2Math.b2MulX(transformA, localPointA);
				tVec = localPointA;
				tMat = transformA.R;
				pointAX = transformA.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
				pointAY = transformA.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
				
				//float32 sgn = b2Dot(pointA - pointB, normal);
				sgn = (pointAX - pointBX) * normalX + (pointAY - pointBY) * normalY;
				if (s < 0.0)
				{
					this.m_axis.NegativeSelf();
				}
			}
			else
			{
				this.m_type = b2SeparationFunction.e_faceA;
				this.m_axis = b2Math.CrossVF(b2Math.SubtractVV(localPointA2, localPointA1), 1.0);
				
				this.m_localPoint = localPointA;
				
				//normal = b2Math.b2MulMV(transformA.R, this.m_axis);
				tVec = this.m_axis;
				tMat = transformA.R;
				normalX = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
				normalY = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
				//pointA = b2Math.b2MulX(transformA, this.m_localPoint);
				tVec = this.m_localPoint;
				tMat = transformA.R;
				pointAX = transformA.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
				pointAY = transformA.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
				//pointB = b2Math.b2MulX(transformB, localPointB);
				tVec = localPointB;
				tMat = transformB.R;
				pointBX = transformB.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
				pointBY = transformB.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
				
				//float32 sgn = b2Dot(pointB - pointA, normal);
				sgn = (pointBX - pointAX) * normalX + (pointBY - pointAY) * normalY;
				if (s < 0.0)
				{
					this.m_axis.NegativeSelf();
				}
			}
		}
	}
	
	public Evaluate(transformA:b2Transform, transformB:b2Transform):number
	{
		var axisA:b2Vec2;
		var axisB:b2Vec2;
		var localPointA:b2Vec2
		var localPointB:b2Vec2;
		var pointA:b2Vec2;
		var pointB:b2Vec2;
		var seperation:number;
		var normal:b2Vec2;
		switch(this.m_type)
		{
			case b2SeparationFunction.e_points:
			{
				axisA = b2Math.MulTMV(transformA.R, this.m_axis);
				axisB = b2Math.MulTMV(transformB.R, this.m_axis.GetNegative());
				localPointA = this.m_proxyA.GetSupportVertex(axisA);
				localPointB = this.m_proxyB.GetSupportVertex(axisB);
				pointA = b2Math.MulX(transformA, localPointA);
				pointB = b2Math.MulX(transformB, localPointB);
				//float32 separation = b2Dot(pointB - pointA, this.m_axis);
				seperation = (pointB.x - pointA.x) * this.m_axis.x + (pointB.y - pointA.y) * this.m_axis.y;
				return seperation;
			}
			case b2SeparationFunction.e_faceA:
			{
				normal = b2Math.MulMV(transformA.R, this.m_axis);
				pointA = b2Math.MulX(transformA, this.m_localPoint);
				
				axisB = b2Math.MulTMV(transformB.R, normal.GetNegative());
				
				localPointB = this.m_proxyB.GetSupportVertex(axisB);
				pointB = b2Math.MulX(transformB, localPointB);
				
				//float32 separation = b2Dot(pointB - pointA, normal);
				seperation = (pointB.x - pointA.x) * normal.x + (pointB.y - pointA.y) * normal.y;
				return seperation;
			}
			case b2SeparationFunction.e_faceB:
			{
				normal = b2Math.MulMV(transformB.R, this.m_axis);
				pointB = b2Math.MulX(transformB, this.m_localPoint);
				
				axisA = b2Math.MulTMV(transformA.R, normal.GetNegative());
				
				localPointA = this.m_proxyA.GetSupportVertex(axisA);
				pointA = b2Math.MulX(transformA, localPointA);
				
				//float32 separation = b2Dot(pointA - pointB, normal);
				seperation = (pointA.x - pointB.x) * normal.x + (pointA.y - pointB.y) * normal.y;
				return seperation;
			}
			default:
			b2Settings.b2Assert(false);
			return 0.0;
		}
	}
	
	public m_proxyA:b2DistanceProxy;
	public m_proxyB:b2DistanceProxy;
	public m_type:number /** int */;
	public m_localPoint:b2Vec2 = new b2Vec2();
	public m_axis:b2Vec2 = new b2Vec2();
}