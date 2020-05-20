import { b2Vec2 } from '../Math';

/**
* A 2-by-2 matrix. Stored in column-major order.
*/
export class b2Mat22
{
    readonly __fast__ = true;

    constructor()
    {
        this.col1.x = this.col2.y = 1.0;
    }
    
    public static FromAngle(angle:number):b2Mat22
    {
        var mat:b2Mat22 = new b2Mat22();
        mat.Set(angle);
        return mat;
    }
    
    public static FromVV(c1:b2Vec2, c2:b2Vec2):b2Mat22
    {
        var mat:b2Mat22 = new b2Mat22();
        mat.SetVV(c1, c2);
        return mat;
    }

    public Set(angle:number) : void
    {
        var c:number = Math.cos(angle);
        var s:number = Math.sin(angle);
        this.col1.x = c; this.col2.x = -s;
        this.col1.y = s; this.col2.y = c;
    }
    
    public SetVV(c1:b2Vec2, c2:b2Vec2) : void
    {
        this.col1.SetV(c1);
        this.col2.SetV(c2);
    }
    
    public Copy():b2Mat22{
        var mat:b2Mat22 = new b2Mat22();
        mat.SetM(this);
        return mat;
    }
    
    public SetM(m:b2Mat22) : void
    {
        this.col1.SetV(m.col1);
        this.col2.SetV(m.col2);
    }
    
    public AddM(m:b2Mat22) : void
    {
        this.col1.x += m.col1.x;
        this.col1.y += m.col1.y;
        this.col2.x += m.col2.x;
        this.col2.y += m.col2.y;
    }
    
    public SetIdentity() : void
    {
        this.col1.x = 1.0; this.col2.x = 0.0;
        this.col1.y = 0.0; this.col2.y = 1.0;
    }

    public SetZero() : void
    {
        this.col1.x = 0.0; this.col2.x = 0.0;
        this.col1.y = 0.0; this.col2.y = 0.0;
    }
    
    public GetAngle() :number
    {
        return Math.atan2(this.col1.y, this.col1.x);
    }

    /**
     * Compute the inverse of this matrix, such that inv(A) * A = identity.
     */
    public GetInverse(out:b2Mat22):b2Mat22
    {
        var a:number = this.col1.x; 
        var b:number = this.col2.x; 
        var c:number = this.col1.y; 
        var d:number = this.col2.y;
        //var B:b2Mat22 = new b2Mat22();
        var det:number = a * d - b * c;
        if (det != 0.0)
        {
            det = 1.0 / det;
        }
        out.col1.x =  det * d;	out.col2.x = -det * b;
        out.col1.y = -det * c;	out.col2.y =  det * a;
        return out;
    }
    
    // Solve A * x = b
    public Solve(out:b2Vec2, bX:number, bY:number):b2Vec2
    {
        //float32 a11 = col1.x, a12 = col2.x, a21 = col1.y, a22 = col2.y;
        var a11:number = this.col1.x;
        var a12:number = this.col2.x;
        var a21:number = this.col1.y;
        var a22:number = this.col2.y;
        //float32 det = a11 * a22 - a12 * a21;
        var det:number = a11 * a22 - a12 * a21;
        if (det != 0.0)
        {
            det = 1.0 / det;
        }
        out.x = det * (a22 * bX - a12 * bY);
        out.y = det * (a11 * bY - a21 * bX);
        
        return out;
    }
    
    public Abs() : void
    {
        this.col1.Abs();
        this.col2.Abs();
    }

    public col1:b2Vec2 = new b2Vec2();
    public col2:b2Vec2 = new b2Vec2();
}