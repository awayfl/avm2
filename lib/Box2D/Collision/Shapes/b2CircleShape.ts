import { b2Shape } from "./b2Shape";
import { b2Transform, b2Vec2, b2Mat22, b2Math } from "../../Common/Math";
import { b2RayCastOutput } from "../b2RayCastOutput";
import { b2RayCastInput } from "../b2RayCastInput";
import { b2AABB } from "../b2AABB";
import { b2MassData } from "./b2MassData";
import { b2Settings } from "../../Common/b2Settings";

/**
* A circle shape.
* @see b2CircleDef
*/
export class b2CircleShape extends b2Shape
{
	__fast__: boolean = true;

	public Copy():b2Shape 
	{
		var s:b2Shape = new b2CircleShape();
		s.Set(this);
		return s;
	}
	
	public Set(other:b2Shape):void 
	{
		super.Set(other);
		if (other instanceof b2CircleShape)
		{
			var other2:b2CircleShape = other as b2CircleShape;
			this.m_p.SetV(other2.m_p);
		}
	}
	
	/**
	* @inheritDoc
	*/
	public TestPoint(transform:b2Transform, p:b2Vec2): boolean{
		//b2Vec2 center = transform.position + b2Mul(transform.R, m_p);
		var tMat:b2Mat22 = transform.R;
		var dX:number = transform.position.x + (tMat.col1.x * this.m_p.x + tMat.col2.x * this.m_p.y);
		var dY:number = transform.position.y + (tMat.col1.y * this.m_p.x + tMat.col2.y * this.m_p.y);
		//b2Vec2 d = p - center;
		dX = p.x - dX;
		dY = p.y - dY;
		//return b2Dot(d, d) <= m_radius * m_radius;
		return (dX*dX + dY*dY) <= this.m_radius * this.m_radius;
	}

	/**
	* @inheritDoc
	*/
	public RayCast(output:b2RayCastOutput, input:b2RayCastInput, transform:b2Transform):boolean
	{
		//b2Vec2 position = transform.position + b2Mul(transform.R, m_p);
		var tMat:b2Mat22 = transform.R;
		var positionX:number = transform.position.x + (tMat.col1.x * this.m_p.x + tMat.col2.x * this.m_p.y);
		var positionY:number = transform.position.y + (tMat.col1.y * this.m_p.x + tMat.col2.y * this.m_p.y);
		
		//b2Vec2 s = input.p1 - position;
		var sX:number = input.p1.x - positionX;
		var sY:number = input.p1.y - positionY;
		//float32 b = b2Dot(s, s) - m_radius * m_radius;
		var b:number = (sX*sX + sY*sY) - this.m_radius * this.m_radius;
		
		/*// Does the segment start inside the circle?
		if (b < 0.0)
		{
			output.fraction = 0;
			output.hit = e_startsInsideCollide;
			return;
		}*/
		
		// Solve quadratic equation.
		//b2Vec2 r = input.p2 - input.p1;
		var rX:number = input.p2.x - input.p1.x;
		var rY:number = input.p2.y - input.p1.y;
		//float32 c =  b2Dot(s, r);
		var c:number =  (sX*rX + sY*rY);
		//float32 rr = b2Dot(r, r);
		var rr:number = (rX*rX + rY*rY);
		var sigma:number = c * c - rr * b;
		
		// Check for negative discriminant and short segment.
		if (sigma < 0.0 || rr < Number.MIN_VALUE)
		{
			return false;
		}
		
		// Find the point of intersection of the line with the circle.
		var a:number = -(c + Math.sqrt(sigma));
		
		// Is the intersection point on the segment?
		if (0.0 <= a && a <= input.maxFraction * rr)
		{
			a /= rr;
			output.fraction = a;
			// manual inline of: output.normal = s + a * r;
			output.normal.x = sX + a * rX;
			output.normal.y = sY + a * rY;
			output.normal.Normalize();
			return true;
		}
		
		return false;
	}

	/**
	* @inheritDoc
	*/
	public ComputeAABB(aabb:b2AABB, transform:b2Transform) : void{
		//b2Vec2 p = transform.position + b2Mul(transform.R, m_p);
		var tMat:b2Mat22 = transform.R;
		var pX:number = transform.position.x + (tMat.col1.x * this.m_p.x + tMat.col2.x * this.m_p.y);
		var pY:number = transform.position.y + (tMat.col1.y * this.m_p.x + tMat.col2.y * this.m_p.y);
		aabb.lowerBound.Set(pX - this.m_radius, pY - this.m_radius);
		aabb.upperBound.Set(pX + this.m_radius, pY + this.m_radius);
	}

	/**
	* @inheritDoc
	*/
	public ComputeMass(massData:b2MassData, density:number) : void{
		massData.mass = density * b2Settings.b2_pi * this.m_radius * this.m_radius;
		massData.center.SetV(this.m_p);
		
		// inertia about the local origin
		//massData.I = massData.mass * (0.5 * m_radius * m_radius + b2Dot(m_p, m_p));
		massData.I = massData.mass * (0.5 * this.m_radius * this.m_radius + (this.m_p.x*this.m_p.x + this.m_p.y*this.m_p.y));
	}
	
	/**
	* @inheritDoc
	*/
	public ComputeSubmergedArea(
			normal:b2Vec2,
			offset:number,
			xf:b2Transform,
			c:b2Vec2):number
	{
		var p:b2Vec2 = b2Math.MulX(xf, this.m_p);
		var l:number = -(b2Math.Dot(normal, p) - offset);
		
		if (l < -this.m_radius + Number.MIN_VALUE)
		{
			//Completely dry
			return 0;
		}
		if (l > this.m_radius)
		{
			//Completely wet
			c.SetV(p);
			return Math.PI * this.m_radius * this.m_radius;
		}
		
		//Magic
		var r2:number = this.m_radius * this.m_radius;
		var l2:number = l * l;
		var area:number = r2 *( Math.asin(l / this.m_radius) + Math.PI / 2) + l * Math.sqrt( r2 - l2 );
		var com:number = -2 / 3 * Math.pow(r2 - l2, 1.5) / area;
		
		c.x = p.x + normal.x * com;
		c.y = p.y + normal.y * com;
		
		return area;
	}

	/**
	 * Get the local position of this circle in its parent body.
	 */
	public GetLocalPosition() : b2Vec2{
		return this.m_p;
	}
	
	/**
	 * Set the local position of this circle in its parent body.
	 */
	public SetLocalPosition(position:b2Vec2):void {
		this.m_p.SetV(position);
	}
	
	/**
	 * Get the radius of the circle
	 */
	public GetRadius():number
	{
		return this.m_radius;
	}
	
	/**
	 * Set the radius of the circle
	 */
	public SetRadius(radius:number):void
	{
		this.m_radius = radius;
	}

	constructor(radius:number = 0){
		super();
		this.m_type = b2Shape.e_circleShape;
		this.m_radius = radius;
	}

	// Local position in parent body
	public m_p:b2Vec2 = new b2Vec2();
	
}
