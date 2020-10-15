import { b2CircleDef } from './Collision/Shapes/b2CircleDef';
import { b2CircleShape } from './Collision/Shapes/b2CircleShape';
import { b2FilterData } from './Collision/Shapes/b2FilterData';
import { b2MassData } from './Collision/Shapes/b2MassData';
import { b2PolygonDef } from './Collision/Shapes/b2PolygonDef';
import { b2PolygonShape } from './Collision/Shapes/b2PolygonShape';
import { b2Shape } from './Collision/Shapes/b2Shape';
import { b2ShapeDef } from './Collision/Shapes/b2ShapeDef';

import { b2AABB } from './Collision/b2AABB';
import { b2Bound } from './Collision/b2Bound';
import { b2BoundValues } from './Collision/b2BoundValues';
import { b2BroadPhase } from './Collision/b2BroadPhase';
import { b2BufferedPair } from './Collision/b2BufferedPair';
import { b2Collision } from './Collision/b2Collision';
import { b2ContactID } from './Collision/b2ContactID';
import { b2ContactPoint } from './Collision/b2ContactPoint';
import { b2Distance } from './Collision/b2Distance';
import { b2Manifold } from './Collision/b2Manifold';
import { b2ManifoldPoint } from './Collision/b2ManifoldPoint';
import { b2OBB } from './Collision/b2OBB';
import { b2Pair } from './Collision/b2Pair';
import { b2PairCallback } from './Collision/b2PairCallback';
import { b2Point } from './Collision/b2Point';
import { b2Proxy } from './Collision/b2Proxy';
import { b2Segment } from './Collision/b2Segment';
import { b2TimeOfImpact } from './Collision/b2TimeOfImpact';
import { ClipVertex } from './Collision/ClipVertex';
import { Features } from './Collision/Features';

import { b2Mat22 } from './Common/Math/b2Mat22';
import { b2Math } from './Common/Math/b2Math';
import { b2Sweep } from './Common/Math/b2Sweep';
import { b2Vec2 } from './Common/Math/b2Vec2';
import { b2XForm } from './Common/Math/b2XForm';

import { b2Color } from './Common/b2Color';
import { b2Settings } from './Common/b2Settings';

import { b2CircleContact } from './Dynamics/Contacts/b2CircleContact';
import { b2Contact } from './Dynamics/Contacts/b2Contact';
import { b2ContactConstraint } from './Dynamics/Contacts/b2ContactConstraint';
import { b2ContactConstraintPoint } from './Dynamics/Contacts/b2ContactConstraintPoint';
import { b2ContactEdge } from './Dynamics/Contacts/b2ContactEdge';
import { b2ContactRegister } from './Dynamics/Contacts/b2ContactRegister';
import { b2ContactResult } from './Dynamics/Contacts/b2ContactResult';
import { b2ContactSolver } from './Dynamics/Contacts/b2ContactSolver';
import { b2NullContact } from './Dynamics/Contacts/b2NullContact';
import { b2PolyAndCircleContact } from './Dynamics/Contacts/b2PolyAndCircleContact';
import { b2PolygonContact } from './Dynamics/Contacts/b2PolygonContact';

import { b2DistanceJoint } from './Dynamics/Joints/b2DistanceJoint';
import { b2DistanceJointDef } from './Dynamics/Joints/b2DistanceJointDef';
import { b2GearJoint } from './Dynamics/Joints/b2GearJoint';
import { b2GearJointDef } from './Dynamics/Joints/b2GearJointDef';
import { b2Jacobian } from './Dynamics/Joints/b2Jacobian';
import { b2Joint } from './Dynamics/Joints/b2Joint';
import { b2JointDef } from './Dynamics/Joints/b2JointDef';
import { b2JointEdge } from './Dynamics/Joints/b2JointEdge';
import { b2MouseJoint } from './Dynamics/Joints/b2MouseJoint';
import { b2MouseJointDef } from './Dynamics/Joints/b2MouseJointDef';
import { b2PrismaticJoint } from './Dynamics/Joints/b2PrismaticJoint';
import { b2PrismaticJointDef } from './Dynamics/Joints/b2PrismaticJointDef';
import { b2PulleyJoint } from './Dynamics/Joints/b2PulleyJoint';
import { b2PulleyJointDef } from './Dynamics/Joints/b2PulleyJointDef';
import { b2RevoluteJoint } from './Dynamics/Joints/b2RevoluteJoint';
import { b2RevoluteJointDef } from './Dynamics/Joints/b2RevoluteJointDef';

import { b2Body } from './Dynamics/b2Body';
import { b2BodyDef } from './Dynamics/b2BodyDef';
import { b2BoundaryListener } from './Dynamics/b2BoundaryListener';
import { b2ContactFilter } from './Dynamics/b2ContactFilter';
import { b2ContactListener } from './Dynamics/b2ContactListener';
import { b2ContactManager } from './Dynamics/b2ContactManager';
import { b2DebugDraw } from './Dynamics/b2DebugDraw';
import { b2DestructionListener } from './Dynamics/b2DestructionListener';
import { b2Island } from './Dynamics/b2Island';
import { b2TimeStep } from './Dynamics/b2TimeStep';
import { b2World } from './Dynamics/b2World';

export default {
	b2CircleDef: b2CircleDef,
	b2CircleShape: b2CircleShape,
	b2FilterData: b2FilterData,
	b2MassData: b2MassData,
	b2PolygonDef: b2PolygonDef,
	b2PolygonShape: b2PolygonShape,
	b2Shape: b2Shape,
	b2ShapeDef: b2ShapeDef,

	b2AABB: b2AABB,
	b2Bound: b2Bound,
	b2BoundValues: b2BoundValues,
	b2BroadPhase: b2BroadPhase,
	b2BufferedPair: b2BufferedPair,
	b2Collision: b2Collision,
	b2ContactID: b2ContactID,
	b2ContactPoint: b2ContactPoint,
	b2Distance: b2Distance,
	b2Manifold: b2Manifold,
	b2ManifoldPoint: b2ManifoldPoint,
	b2OBB: b2OBB,
	b2Pair: b2Pair,
	b2PairCallback: b2PairCallback,
	b2Point: b2Point,
	b2Proxy: b2Proxy,
	b2Segment: b2Segment,
	b2TimeOfImpact: b2TimeOfImpact,
	ClipVertex: ClipVertex,
	Features: Features,

	b2Mat22: b2Mat22,
	b2Math: b2Math,
	b2Sweep: b2Sweep,
	b2Vec2: b2Vec2,
	b2XForm: b2XForm,

	b2Color: b2Color,
	b2Settings: b2Settings,

	b2CircleContact: b2CircleContact,
	b2Contact: b2Contact,
	b2ContactConstraint: b2ContactConstraint,
	b2ContactConstraintPoint: b2ContactConstraintPoint,
	b2ContactEdge: b2ContactEdge,
	b2ContactRegister: b2ContactRegister,
	b2ContactResult: b2ContactResult,
	b2ContactSolver: b2ContactSolver,
	b2NullContact: b2NullContact,
	b2PolyAndCircleContact: b2PolyAndCircleContact,
	b2PolygonContact: b2PolygonContact,

	b2DistanceJoint: b2DistanceJoint,
	b2DistanceJointDef: b2DistanceJointDef,
	b2GearJoint: b2GearJoint,
	b2GearJointDef: b2GearJointDef,
	b2Jacobian: b2Jacobian,
	b2Joint: b2Joint,
	b2JointDef: b2JointDef,
	b2JointEdge: b2JointEdge,
	b2MouseJoint: b2MouseJoint,
	b2MouseJointDef: b2MouseJointDef,
	b2PrismaticJoint: b2PrismaticJoint,
	b2PrismaticJointDef: b2PrismaticJointDef,
	b2PulleyJoint: b2PulleyJoint,
	b2PulleyJointDef: b2PulleyJointDef,
	b2RevoluteJoint: b2RevoluteJoint,
	b2RevoluteJointDef: b2RevoluteJointDef,

	b2Body: b2Body,
	b2BodyDef: b2BodyDef,
	b2BoundaryListener: b2BoundaryListener,
	b2ContactFilter: b2ContactFilter,
	b2ContactListener: b2ContactListener,
	b2ContactManager: b2ContactManager,
	b2DebugDraw: b2DebugDraw,
	b2DestructionListener: b2DestructionListener,
	b2Island: b2Island,
	b2TimeStep: b2TimeStep,
	b2World: b2World
};
/*
export function b2Class(name: string, params: any[]): any {

    var c:any = lookup[name];
    if (!c)
        return null;

    var i:any = Object.create(c.prototype);
    c.apply(i, params);

    i.__fast__ = true;

    return i;
}*/
