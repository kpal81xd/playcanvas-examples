import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';
import { Debug } from '../core/debug.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';

const scaleCompensatePosTransform = new Mat4();
const scaleCompensatePos = new Vec3();
const scaleCompensateRot = new Quat();
const scaleCompensateRot2 = new Quat();
const scaleCompensateScale = new Vec3();
const scaleCompensateScaleForParent = new Vec3();
const tmpMat4 = new Mat4();
const tmpQuat = new Quat();
const position = new Vec3();
const invParentWtm = new Mat4();
const rotation = new Quat();
const invParentRot = new Quat();
const matrix = new Mat4();
const target = new Vec3();
const up = new Vec3();

/**
 * Helper function that handles signature overloading to receive a test function.
 *
 * @param {FindNodeCallback|string} attr - Attribute or lambda.
 * @param {*} [value] - Optional value in case of `attr` being a `string`
 * @returns {FindNodeCallback} Test function that receives a GraphNode and returns a boolean.
 * @ignore
 */
function createTest(attr, value) {
  if (attr instanceof Function) {
    return attr;
  }
  return node => {
    let x = node[attr];
    if (x instanceof Function) {
      x = x();
    }
    return x === value;
  };
}

/**
 * Helper function to recurse findOne without calling createTest constantly.
 *
 * @param {GraphNode} node - Current node.
 * @param {FindNodeCallback} test - Test function.
 * @returns {GraphNode|null} A graph node that matches the search criteria. Returns null if no
 * node is found.
 * @ignore
 */
function findNode(node, test) {
  if (test(node)) return node;
  const children = node._children;
  const len = children.length;
  for (let i = 0; i < len; ++i) {
    const result = findNode(children[i], test);
    if (result) return result;
  }
  return null;
}

/**
 * Callback used by {@link GraphNode#find} and {@link GraphNode#findOne} to search through a graph
 * node and all of its descendants.
 *
 * @callback FindNodeCallback
 * @param {GraphNode} node - The current graph node.
 * @returns {boolean} Returning `true` will result in that node being returned from
 * {@link GraphNode#find} or {@link GraphNode#findOne}.
 */

/**
 * Callback used by {@link GraphNode#forEach} to iterate through a graph node and all of its
 * descendants.
 *
 * @callback ForEachNodeCallback
 * @param {GraphNode} node - The current graph node.
 */

/**
 * A hierarchical scene node.
 *
 * @augments EventHandler
 */
class GraphNode extends EventHandler {
  /**
   * Create a new GraphNode instance.
   *
   * @param {string} [name] - The non-unique name of a graph node. Defaults to 'Untitled'.
   */
  constructor(name = 'Untitled') {
    super();
    /**
     * The non-unique name of a graph node. Defaults to 'Untitled'.
     *
     * @type {string}
     */
    this.name = void 0;
    /**
     * Interface for tagging graph nodes. Tag based searches can be performed using the
     * {@link GraphNode#findByTag} function.
     *
     * @type {Tags}
     */
    this.tags = new Tags(this);
    /** @private */
    this._labels = {};
    // Local-space properties of transform (only first 3 are settable by the user)
    /**
     * @type {Vec3}
     * @private
     */
    this.localPosition = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this.localRotation = new Quat();
    /**
     * @type {Vec3}
     * @private
     */
    this.localScale = new Vec3(1, 1, 1);
    /**
     * @type {Vec3}
     * @private
     */
    this.localEulerAngles = new Vec3();
    // Only calculated on request
    // World-space properties of transform
    /**
     * @type {Vec3}
     * @private
     */
    this.position = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this.rotation = new Quat();
    /**
     * @type {Vec3}
     * @private
     */
    this.eulerAngles = new Vec3();
    /**
     * @type {Vec3|null}
     * @private
     */
    this._scale = null;
    /**
     * @type {Mat4}
     * @private
     */
    this.localTransform = new Mat4();
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyLocal = false;
    /**
     * @type {number}
     * @private
     */
    this._aabbVer = 0;
    /**
     * Marks the node to ignore hierarchy sync entirely (including children nodes). The engine code
     * automatically freezes and unfreezes objects whenever required. Segregating dynamic and
     * stationary nodes into subhierarchies allows to reduce sync time significantly.
     *
     * @type {boolean}
     * @private
     */
    this._frozen = false;
    /**
     * @type {Mat4}
     * @private
     */
    this.worldTransform = new Mat4();
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyWorld = false;
    /**
     * Cached value representing the negatively scaled world transform. If the value is 0, this
     * marks this value as dirty and it needs to be recalculated. If the value is 1, the world
     * transform is not negatively scaled. If the value is -1, the world transform is negatively
     * scaled.
     *
     * @type {number}
     * @private
     */
    this._worldScaleSign = 0;
    /**
     * @type {Mat3}
     * @private
     */
    this._normalMatrix = new Mat3();
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyNormal = true;
    /**
     * @type {Vec3|null}
     * @private
     */
    this._right = null;
    /**
     * @type {Vec3|null}
     * @private
     */
    this._up = null;
    /**
     * @type {Vec3|null}
     * @private
     */
    this._forward = null;
    /**
     * @type {GraphNode|null}
     * @private
     */
    this._parent = null;
    /**
     * @type {GraphNode[]}
     * @private
     */
    this._children = [];
    /**
     * @type {number}
     * @private
     */
    this._graphDepth = 0;
    /**
     * Represents enabled state of the entity. If the entity is disabled, the entity including all
     * children are excluded from updates.
     *
     * @type {boolean}
     * @private
     */
    this._enabled = true;
    /**
     * Represents enabled state of the entity in the hierarchy. It's true only if this entity and
     * all parent entities all the way to the scene's root are enabled.
     *
     * @type {boolean}
     * @private
     */
    this._enabledInHierarchy = false;
    /**
     * @type {boolean}
     * @ignore
     */
    this.scaleCompensation = false;
    this.name = name;
  }

  /**
   * The normalized local space X-axis vector of the graph node in world space.
   *
   * @type {Vec3}
   */
  get right() {
    if (!this._right) {
      this._right = new Vec3();
    }
    return this.getWorldTransform().getX(this._right).normalize();
  }

  /**
   * The normalized local space Y-axis vector of the graph node in world space.
   *
   * @type {Vec3}
   */
  get up() {
    if (!this._up) {
      this._up = new Vec3();
    }
    return this.getWorldTransform().getY(this._up).normalize();
  }

  /**
   * The normalized local space negative Z-axis vector of the graph node in world space.
   *
   * @type {Vec3}
   */
  get forward() {
    if (!this._forward) {
      this._forward = new Vec3();
    }
    return this.getWorldTransform().getZ(this._forward).normalize().mulScalar(-1);
  }

  /**
   * A matrix used to transform the normal.
   *
   * @type  {Mat3}
   * @ignore
   */
  get normalMatrix() {
    const normalMat = this._normalMatrix;
    if (this._dirtyNormal) {
      normalMat.invertMat4(this.getWorldTransform()).transpose();
      this._dirtyNormal = false;
    }
    return normalMat;
  }

  /**
   * Enable or disable a GraphNode. If one of the GraphNode's parents is disabled there will be
   * no other side effects. If all the parents are enabled then the new value will activate or
   * deactivate all the enabled children of the GraphNode.
   *
   * @type {boolean}
   */
  set enabled(enabled) {
    if (this._enabled !== enabled) {
      var _this$_parent;
      this._enabled = enabled;

      // if enabling entity, make all children enabled in hierarchy only when the parent is as well
      // if disabling entity, make all children disabled in hierarchy in all cases
      if (enabled && (_this$_parent = this._parent) != null && _this$_parent.enabled || !enabled) {
        this._notifyHierarchyStateChanged(this, enabled);
      }
    }
  }
  get enabled() {
    // make sure to check this._enabled too because if that
    // was false when a parent was updated the _enabledInHierarchy
    // flag may not have been updated for optimization purposes
    return this._enabled && this._enabledInHierarchy;
  }

  /**
   * A read-only property to get a parent graph node.
   *
   * @type {GraphNode|null}
   */
  get parent() {
    return this._parent;
  }

  /**
   * A read-only property to get the path of the graph node relative to the root of the hierarchy.
   *
   * @type {string}
   */
  get path() {
    let node = this._parent;
    if (!node) {
      return '';
    }
    let result = this.name;
    while (node && node._parent) {
      result = `${node.name}/${result}`;
      node = node._parent;
    }
    return result;
  }

  /**
   * A read-only property to get highest graph node from current node.
   *
   * @type {GraphNode}
   */
  get root() {
    let result = this;
    while (result._parent) {
      result = result._parent;
    }
    return result;
  }

  /**
   * A read-only property to get the children of this graph node.
   *
   * @type {GraphNode[]}
   */
  get children() {
    return this._children;
  }

  /**
   * A read-only property to get the depth of this child within the graph. Note that for
   * performance reasons this is only recalculated when a node is added to a new parent, i.e. It
   * is not recalculated when a node is simply removed from the graph.
   *
   * @type {number}
   */
  get graphDepth() {
    return this._graphDepth;
  }

  /**
   * @param {GraphNode} node - Graph node to update.
   * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
   * @private
   */
  _notifyHierarchyStateChanged(node, enabled) {
    node._onHierarchyStateChanged(enabled);
    const c = node._children;
    for (let i = 0, len = c.length; i < len; i++) {
      if (c[i]._enabled) this._notifyHierarchyStateChanged(c[i], enabled);
    }
  }

  /**
   * Called when the enabled flag of the entity or one of its parents changes.
   *
   * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
   * @private
   */
  _onHierarchyStateChanged(enabled) {
    // Override in derived classes
    this._enabledInHierarchy = enabled;
    if (enabled && !this._frozen) this._unfreezeParentToRoot();
  }

  /**
   * @param {this} clone - The cloned graph node to copy into.
   * @private
   */
  _cloneInternal(clone) {
    clone.name = this.name;
    const tags = this.tags._list;
    clone.tags.clear();
    for (let i = 0; i < tags.length; i++) clone.tags.add(tags[i]);
    clone._labels = Object.assign({}, this._labels);
    clone.localPosition.copy(this.localPosition);
    clone.localRotation.copy(this.localRotation);
    clone.localScale.copy(this.localScale);
    clone.localEulerAngles.copy(this.localEulerAngles);
    clone.position.copy(this.position);
    clone.rotation.copy(this.rotation);
    clone.eulerAngles.copy(this.eulerAngles);
    clone.localTransform.copy(this.localTransform);
    clone._dirtyLocal = this._dirtyLocal;
    clone.worldTransform.copy(this.worldTransform);
    clone._dirtyWorld = this._dirtyWorld;
    clone._dirtyNormal = this._dirtyNormal;
    clone._aabbVer = this._aabbVer + 1;
    clone._enabled = this._enabled;
    clone.scaleCompensation = this.scaleCompensation;

    // false as this node is not in the hierarchy yet
    clone._enabledInHierarchy = false;
  }

  /**
   * Clone a graph node.
   *
   * @returns {this} A clone of the specified graph node.
   */
  clone() {
    const clone = new this.constructor();
    this._cloneInternal(clone);
    return clone;
  }

  /**
   * Copy a graph node.
   *
   * @param {GraphNode} source - The graph node to copy.
   * @returns {GraphNode} The destination graph node.
   * @ignore
   */
  copy(source) {
    source._cloneInternal(this);
    return this;
  }

  /**
   * Detach a GraphNode from the hierarchy and recursively destroy all children.
   *
   * @example
   * const firstChild = this.entity.children[0];
   * firstChild.destroy(); // delete child, all components and remove from hierarchy
   */
  destroy() {
    // Detach from parent
    this.remove();

    // Recursively destroy all children
    const children = this._children;
    while (children.length) {
      // Remove last child from the array
      const child = children.pop();
      // Disconnect it from the parent: this is only an optimization step, to prevent calling
      // GraphNode#removeChild which would try to refind it via this._children.indexOf (which
      // will fail, because we just removed it).
      child._parent = null;
      child.destroy();
    }

    // fire destroy event
    this.fire('destroy', this);

    // clear all events
    this.off();
  }

  /**
   * Search the graph node and all of its descendants for the nodes that satisfy some search
   * criteria.
   *
   * @param {FindNodeCallback|string} attr - This can either be a function or a string. If it's a
   * function, it is executed for each descendant node to test if node satisfies the search
   * logic. Returning true from the function will include the node into the results. If it's a
   * string then it represents the name of a field or a method of the node. If this is the name
   * of a field then the value passed as the second argument will be checked for equality. If
   * this is the name of a function then the return value of the function will be checked for
   * equality against the valued passed as the second argument to this function.
   * @param {object} [value] - If the first argument (attr) is a property name then this value
   * will be checked against the value of the property.
   * @returns {GraphNode[]} The array of graph nodes that match the search criteria.
   * @example
   * // Finds all nodes that have a model component and have 'door' in their lower-cased name
   * const doors = house.find(function (node) {
   *     return node.model && node.name.toLowerCase().indexOf('door') !== -1;
   * });
   * @example
   * // Finds all nodes that have the name property set to 'Test'
   * const entities = parent.find('name', 'Test');
   */
  find(attr, value) {
    const results = [];
    const test = createTest(attr, value);
    this.forEach(node => {
      if (test(node)) results.push(node);
    });
    return results;
  }

  /**
   * Search the graph node and all of its descendants for the first node that satisfies some
   * search criteria.
   *
   * @param {FindNodeCallback|string} attr - This can either be a function or a string. If it's a
   * function, it is executed for each descendant node to test if node satisfies the search
   * logic. Returning true from the function will result in that node being returned from
   * findOne. If it's a string then it represents the name of a field or a method of the node. If
   * this is the name of a field then the value passed as the second argument will be checked for
   * equality. If this is the name of a function then the return value of the function will be
   * checked for equality against the valued passed as the second argument to this function.
   * @param {object} [value] - If the first argument (attr) is a property name then this value
   * will be checked against the value of the property.
   * @returns {GraphNode|null} A graph node that match the search criteria. Returns null if no
   * node is found.
   * @example
   * // Find the first node that is called 'head' and has a model component
   * const head = player.findOne(function (node) {
   *     return node.model && node.name === 'head';
   * });
   * @example
   * // Finds the first node that has the name property set to 'Test'
   * const node = parent.findOne('name', 'Test');
   */
  findOne(attr, value) {
    const test = createTest(attr, value);
    return findNode(this, test);
  }

  /**
   * Return all graph nodes that satisfy the search query. Query can be simply a string, or comma
   * separated strings, to have inclusive results of assets that match at least one query. A
   * query that consists of an array of tags can be used to match graph nodes that have each tag
   * of array.
   *
   * @param {...*} query - Name of a tag or array of tags.
   * @returns {GraphNode[]} A list of all graph nodes that match the query.
   * @example
   * // Return all graph nodes that tagged by `animal`
   * const animals = node.findByTag("animal");
   * @example
   * // Return all graph nodes that tagged by `bird` OR `mammal`
   * const birdsAndMammals = node.findByTag("bird", "mammal");
   * @example
   * // Return all assets that tagged by `carnivore` AND `mammal`
   * const meatEatingMammals = node.findByTag(["carnivore", "mammal"]);
   * @example
   * // Return all assets that tagged by (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
   * const meatEatingMammalsAndReptiles = node.findByTag(["carnivore", "mammal"], ["carnivore", "reptile"]);
   */
  findByTag() {
    const query = arguments;
    const results = [];
    const queryNode = (node, checkNode) => {
      if (checkNode && node.tags.has(...query)) {
        results.push(node);
      }
      for (let i = 0; i < node._children.length; i++) {
        queryNode(node._children[i], true);
      }
    };
    queryNode(this, false);
    return results;
  }

  /**
   * Get the first node found in the graph with the name. The search is depth first.
   *
   * @param {string} name - The name of the graph.
   * @returns {GraphNode|null} The first node to be found matching the supplied name. Returns
   * null if no node is found.
   */
  findByName(name) {
    return this.findOne('name', name);
  }

  /**
   * Get the first node found in the graph by its full path in the graph. The full path has this
   * form 'parent/child/sub-child'. The search is depth first.
   *
   * @param {string|string[]} path - The full path of the {@link GraphNode} as either a string or
   * array of {@link GraphNode} names.
   * @returns {GraphNode|null} The first node to be found matching the supplied path. Returns
   * null if no node is found.
   * @example
   * // String form
   * const grandchild = this.entity.findByPath('child/grandchild');
   * @example
   * // Array form
   * const grandchild = this.entity.findByPath(['child', 'grandchild']);
   */
  findByPath(path) {
    // accept either string path with '/' separators or array of parts.
    const parts = Array.isArray(path) ? path : path.split('/');
    let result = this;
    for (let i = 0, imax = parts.length; i < imax; ++i) {
      result = result.children.find(c => c.name === parts[i]);
      if (!result) {
        return null;
      }
    }
    return result;
  }

  /**
   * Executes a provided function once on this graph node and all of its descendants.
   *
   * @param {ForEachNodeCallback} callback - The function to execute on the graph node and each
   * descendant.
   * @param {object} [thisArg] - Optional value to use as this when executing callback function.
   * @example
   * // Log the path and name of each node in descendant tree starting with "parent"
   * parent.forEach(function (node) {
   *     console.log(node.path + "/" + node.name);
   * });
   */
  forEach(callback, thisArg) {
    callback.call(thisArg, this);
    const children = this._children;
    const len = children.length;
    for (let i = 0; i < len; ++i) {
      children[i].forEach(callback, thisArg);
    }
  }

  /**
   * Check if node is descendant of another node.
   *
   * @param {GraphNode} node - Potential ancestor of node.
   * @returns {boolean} If node is descendant of another node.
   * @example
   * if (roof.isDescendantOf(house)) {
   *     // roof is descendant of house entity
   * }
   */
  isDescendantOf(node) {
    let parent = this._parent;
    while (parent) {
      if (parent === node) return true;
      parent = parent._parent;
    }
    return false;
  }

  /**
   * Check if node is ancestor for another node.
   *
   * @param {GraphNode} node - Potential descendant of node.
   * @returns {boolean} If node is ancestor for another node.
   * @example
   * if (body.isAncestorOf(foot)) {
   *     // foot is within body's hierarchy
   * }
   */
  isAncestorOf(node) {
    return node.isDescendantOf(this);
  }

  /**
   * Get the world space rotation for the specified GraphNode in Euler angle form. The rotation
   * is returned as euler angles in a {@link Vec3}. The value returned by this function should be
   * considered read-only. In order to set the world-space rotation of the graph node, use
   * {@link GraphNode#setEulerAngles}.
   *
   * @returns {Vec3} The world space rotation of the graph node in Euler angle form.
   * @example
   * const angles = this.entity.getEulerAngles();
   * angles.y = 180; // rotate the entity around Y by 180 degrees
   * this.entity.setEulerAngles(angles);
   */
  getEulerAngles() {
    this.getWorldTransform().getEulerAngles(this.eulerAngles);
    return this.eulerAngles;
  }

  /**
   * Get the rotation in local space for the specified GraphNode. The rotation is returned as
   * euler angles in a {@link Vec3}. The returned vector should be considered read-only. To
   * update the local rotation, use {@link GraphNode#setLocalEulerAngles}.
   *
   * @returns {Vec3} The local space rotation of the graph node as euler angles in XYZ order.
   * @example
   * const angles = this.entity.getLocalEulerAngles();
   * angles.y = 180;
   * this.entity.setLocalEulerAngles(angles);
   */
  getLocalEulerAngles() {
    this.localRotation.getEulerAngles(this.localEulerAngles);
    return this.localEulerAngles;
  }

  /**
   * Get the position in local space for the specified GraphNode. The position is returned as a
   * {@link Vec3}. The returned vector should be considered read-only. To update the local
   * position, use {@link GraphNode#setLocalPosition}.
   *
   * @returns {Vec3} The local space position of the graph node.
   * @example
   * const position = this.entity.getLocalPosition();
   * position.x += 1; // move the entity 1 unit along x.
   * this.entity.setLocalPosition(position);
   */
  getLocalPosition() {
    return this.localPosition;
  }

  /**
   * Get the rotation in local space for the specified GraphNode. The rotation is returned as a
   * {@link Quat}. The returned quaternion should be considered read-only. To update the local
   * rotation, use {@link GraphNode#setLocalRotation}.
   *
   * @returns {Quat} The local space rotation of the graph node as a quaternion.
   * @example
   * const rotation = this.entity.getLocalRotation();
   */
  getLocalRotation() {
    return this.localRotation;
  }

  /**
   * Get the scale in local space for the specified GraphNode. The scale is returned as a
   * {@link Vec3}. The returned vector should be considered read-only. To update the local scale,
   * use {@link GraphNode#setLocalScale}.
   *
   * @returns {Vec3} The local space scale of the graph node.
   * @example
   * const scale = this.entity.getLocalScale();
   * scale.x = 100;
   * this.entity.setLocalScale(scale);
   */
  getLocalScale() {
    return this.localScale;
  }

  /**
   * Get the local transform matrix for this graph node. This matrix is the transform relative to
   * the node's parent's world transformation matrix.
   *
   * @returns {Mat4} The node's local transformation matrix.
   * @example
   * const transform = this.entity.getLocalTransform();
   */
  getLocalTransform() {
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this._dirtyLocal = false;
    }
    return this.localTransform;
  }

  /**
   * Get the world space position for the specified GraphNode. The position is returned as a
   * {@link Vec3}. The value returned by this function should be considered read-only. In order
   * to set the world-space position of the graph node, use {@link GraphNode#setPosition}.
   *
   * @returns {Vec3} The world space position of the graph node.
   * @example
   * const position = this.entity.getPosition();
   * position.x = 10;
   * this.entity.setPosition(position);
   */
  getPosition() {
    this.getWorldTransform().getTranslation(this.position);
    return this.position;
  }

  /**
   * Get the world space rotation for the specified GraphNode. The rotation is returned as a
   * {@link Quat}. The value returned by this function should be considered read-only. In order
   * to set the world-space rotation of the graph node, use {@link GraphNode#setRotation}.
   *
   * @returns {Quat} The world space rotation of the graph node as a quaternion.
   * @example
   * const rotation = this.entity.getRotation();
   */
  getRotation() {
    this.rotation.setFromMat4(this.getWorldTransform());
    return this.rotation;
  }

  /**
   * Get the world space scale for the specified GraphNode. The returned value will only be
   * correct for graph nodes that have a non-skewed world transform (a skew can be introduced by
   * the compounding of rotations and scales higher in the graph node hierarchy). The scale is
   * returned as a {@link Vec3}. The value returned by this function should be considered
   * read-only. Note that it is not possible to set the world space scale of a graph node
   * directly.
   *
   * @returns {Vec3} The world space scale of the graph node.
   * @example
   * const scale = this.entity.getScale();
   * @ignore
   */
  getScale() {
    if (!this._scale) {
      this._scale = new Vec3();
    }
    return this.getWorldTransform().getScale(this._scale);
  }

  /**
   * Get the world transformation matrix for this graph node.
   *
   * @returns {Mat4} The node's world transformation matrix.
   * @example
   * const transform = this.entity.getWorldTransform();
   */
  getWorldTransform() {
    if (!this._dirtyLocal && !this._dirtyWorld) return this.worldTransform;
    if (this._parent) this._parent.getWorldTransform();
    this._sync();
    return this.worldTransform;
  }

  /**
   * Returns cached value of negative scale of the world transform.
   *
   * @returns {number} -1 if world transform has negative scale, 1 otherwise.
   * @ignore
   */
  get worldScaleSign() {
    if (this._worldScaleSign === 0) {
      this._worldScaleSign = this.getWorldTransform().scaleSign;
    }
    return this._worldScaleSign;
  }

  /**
   * Remove graph node from current parent.
   */
  remove() {
    var _this$_parent2;
    (_this$_parent2 = this._parent) == null || _this$_parent2.removeChild(this);
  }

  /**
   * Remove graph node from current parent and add as child to new parent.
   *
   * @param {GraphNode} parent - New parent to attach graph node to.
   * @param {number} [index] - The child index where the child node should be placed.
   */
  reparent(parent, index) {
    this.remove();
    if (parent) {
      if (index >= 0) {
        parent.insertChild(this, index);
      } else {
        parent.addChild(this);
      }
    }
  }

  /**
   * Sets the local-space rotation of the specified graph node using euler angles. Eulers are
   * interpreted in XYZ order. Eulers must be specified in degrees. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the local-space euler
   * rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around local-space
   * x-axis in degrees.
   * @param {number} [y] - Rotation around local-space y-axis in degrees.
   * @param {number} [z] - Rotation around local-space z-axis in degrees.
   * @example
   * // Set rotation of 90 degrees around y-axis via 3 numbers
   * this.entity.setLocalEulerAngles(0, 90, 0);
   * @example
   * // Set rotation of 90 degrees around y-axis via a vector
   * const angles = new pc.Vec3(0, 90, 0);
   * this.entity.setLocalEulerAngles(angles);
   */
  setLocalEulerAngles(x, y, z) {
    this.localRotation.setFromEulerAngles(x, y, z);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the local-space position of the specified graph node. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the local-space
   * position.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space position or
   * x-coordinate of local-space position.
   * @param {number} [y] - Y-coordinate of local-space position.
   * @param {number} [z] - Z-coordinate of local-space position.
   * @example
   * // Set via 3 numbers
   * this.entity.setLocalPosition(0, 10, 0);
   * @example
   * // Set via vector
   * const pos = new pc.Vec3(0, 10, 0);
   * this.entity.setLocalPosition(pos);
   */
  setLocalPosition(x, y, z) {
    if (x instanceof Vec3) {
      this.localPosition.copy(x);
    } else {
      this.localPosition.set(x, y, z);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the local-space rotation of the specified graph node. This function has two valid
   * signatures: you can either pass a quaternion or 3 numbers to specify the local-space
   * rotation.
   *
   * @param {Quat|number} x - Quaternion holding local-space rotation or x-component of
   * local-space quaternion rotation.
   * @param {number} [y] - Y-component of local-space quaternion rotation.
   * @param {number} [z] - Z-component of local-space quaternion rotation.
   * @param {number} [w] - W-component of local-space quaternion rotation.
   * @example
   * // Set via 4 numbers
   * this.entity.setLocalRotation(0, 0, 0, 1);
   * @example
   * // Set via quaternion
   * const q = pc.Quat();
   * this.entity.setLocalRotation(q);
   */
  setLocalRotation(x, y, z, w) {
    if (x instanceof Quat) {
      this.localRotation.copy(x);
    } else {
      this.localRotation.set(x, y, z, w);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the local-space scale factor of the specified graph node. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the local-space scale.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space scale or x-coordinate
   * of local-space scale.
   * @param {number} [y] - Y-coordinate of local-space scale.
   * @param {number} [z] - Z-coordinate of local-space scale.
   * @example
   * // Set via 3 numbers
   * this.entity.setLocalScale(10, 10, 10);
   * @example
   * // Set via vector
   * const scale = new pc.Vec3(10, 10, 10);
   * this.entity.setLocalScale(scale);
   */
  setLocalScale(x, y, z) {
    if (x instanceof Vec3) {
      this.localScale.copy(x);
    } else {
      this.localScale.set(x, y, z);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /** @private */
  _dirtifyLocal() {
    if (!this._dirtyLocal) {
      this._dirtyLocal = true;
      if (!this._dirtyWorld) this._dirtifyWorld();
    }
  }

  /** @private */
  _unfreezeParentToRoot() {
    let p = this._parent;
    while (p) {
      p._frozen = false;
      p = p._parent;
    }
  }

  /** @private */
  _dirtifyWorld() {
    if (!this._dirtyWorld) this._unfreezeParentToRoot();
    this._dirtifyWorldInternal();
  }

  /** @private */
  _dirtifyWorldInternal() {
    if (!this._dirtyWorld) {
      this._frozen = false;
      this._dirtyWorld = true;
      for (let i = 0; i < this._children.length; i++) {
        if (!this._children[i]._dirtyWorld) this._children[i]._dirtifyWorldInternal();
      }
    }
    this._dirtyNormal = true;
    this._worldScaleSign = 0; // world matrix is dirty, mark this flag dirty too
    this._aabbVer++;
  }

  /**
   * Sets the world-space position of the specified graph node. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the world-space
   * position.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding world-space position or
   * x-coordinate of world-space position.
   * @param {number} [y] - Y-coordinate of world-space position.
   * @param {number} [z] - Z-coordinate of world-space position.
   * @example
   * // Set via 3 numbers
   * this.entity.setPosition(0, 10, 0);
   * @example
   * // Set via vector
   * const position = new pc.Vec3(0, 10, 0);
   * this.entity.setPosition(position);
   */
  setPosition(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }
    if (this._parent === null) {
      this.localPosition.copy(position);
    } else {
      invParentWtm.copy(this._parent.getWorldTransform()).invert();
      invParentWtm.transformPoint(position, this.localPosition);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the world-space rotation of the specified graph node. This function has two valid
   * signatures: you can either pass a quaternion or 3 numbers to specify the world-space
   * rotation.
   *
   * @param {Quat|number} x - Quaternion holding world-space rotation or x-component of
   * world-space quaternion rotation.
   * @param {number} [y] - Y-component of world-space quaternion rotation.
   * @param {number} [z] - Z-component of world-space quaternion rotation.
   * @param {number} [w] - W-component of world-space quaternion rotation.
   * @example
   * // Set via 4 numbers
   * this.entity.setRotation(0, 0, 0, 1);
   * @example
   * // Set via quaternion
   * const q = pc.Quat();
   * this.entity.setRotation(q);
   */
  setRotation(x, y, z, w) {
    if (x instanceof Quat) {
      rotation.copy(x);
    } else {
      rotation.set(x, y, z, w);
    }
    if (this._parent === null) {
      this.localRotation.copy(rotation);
    } else {
      const parentRot = this._parent.getRotation();
      invParentRot.copy(parentRot).invert();
      this.localRotation.copy(invParentRot).mul(rotation);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the world-space rotation of the specified graph node using euler angles. Eulers are
   * interpreted in XYZ order. Eulers must be specified in degrees. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the world-space euler
   * rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around world-space
   * x-axis in degrees.
   * @param {number} [y] - Rotation around world-space y-axis in degrees.
   * @param {number} [z] - Rotation around world-space z-axis in degrees.
   * @example
   * // Set rotation of 90 degrees around world-space y-axis via 3 numbers
   * this.entity.setEulerAngles(0, 90, 0);
   * @example
   * // Set rotation of 90 degrees around world-space y-axis via a vector
   * const angles = new pc.Vec3(0, 90, 0);
   * this.entity.setEulerAngles(angles);
   */
  setEulerAngles(x, y, z) {
    this.localRotation.setFromEulerAngles(x, y, z);
    if (this._parent !== null) {
      const parentRot = this._parent.getRotation();
      invParentRot.copy(parentRot).invert();
      this.localRotation.mul2(invParentRot, this.localRotation);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Add a new child to the child list and update the parent value of the child node.
   * If the node already had a parent, it is removed from its child list.
   *
   * @param {GraphNode} node - The new child to add.
   * @example
   * const e = new pc.Entity(app);
   * this.entity.addChild(e);
   */
  addChild(node) {
    this._prepareInsertChild(node);
    this._children.push(node);
    this._onInsertChild(node);
  }

  /**
   * Add a child to this node, maintaining the child's transform in world space.
   * If the node already had a parent, it is removed from its child list.
   *
   * @param {GraphNode} node - The child to add.
   * @example
   * const e = new pc.Entity(app);
   * this.entity.addChildAndSaveTransform(e);
   * @ignore
   */
  addChildAndSaveTransform(node) {
    const wPos = node.getPosition();
    const wRot = node.getRotation();
    this._prepareInsertChild(node);
    node.setPosition(tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
    node.setRotation(tmpQuat.copy(this.getRotation()).invert().mul(wRot));
    this._children.push(node);
    this._onInsertChild(node);
  }

  /**
   * Insert a new child to the child list at the specified index and update the parent value of
   * the child node. If the node already had a parent, it is removed from its child list.
   *
   * @param {GraphNode} node - The new child to insert.
   * @param {number} index - The index in the child list of the parent where the new node will be
   * inserted.
   * @example
   * const e = new pc.Entity(app);
   * this.entity.insertChild(e, 1);
   */
  insertChild(node, index) {
    this._prepareInsertChild(node);
    this._children.splice(index, 0, node);
    this._onInsertChild(node);
  }

  /**
   * Prepares node for being inserted to a parent node, and removes it from the previous parent.
   *
   * @param {GraphNode} node - The node being inserted.
   * @private
   */
  _prepareInsertChild(node) {
    // remove it from the existing parent
    node.remove();
    Debug.assert(node !== this, `GraphNode ${node == null ? void 0 : node.name} cannot be a child of itself`);
    Debug.assert(!this.isDescendantOf(node), `GraphNode ${node == null ? void 0 : node.name} cannot add an ancestor as a child`);
  }

  /**
   * Fires an event on all children of the node. The event `name` is fired on the first (root)
   * node only. The event `nameHierarchy` is fired for all children.
   *
   * @param {string} name - The name of the event to fire on the root.
   * @param {string} nameHierarchy - The name of the event to fire for all descendants.
   * @param {GraphNode} parent - The parent of the node being added/removed from the hierarchy.
   * @private
   */
  _fireOnHierarchy(name, nameHierarchy, parent) {
    this.fire(name, parent);
    for (let i = 0; i < this._children.length; i++) {
      this._children[i]._fireOnHierarchy(nameHierarchy, nameHierarchy, parent);
    }
  }

  /**
   * Called when a node is inserted into a node's child list.
   *
   * @param {GraphNode} node - The node that was inserted.
   * @private
   */
  _onInsertChild(node) {
    node._parent = this;

    // the child node should be enabled in the hierarchy only if itself is enabled and if
    // this parent is enabled
    const enabledInHierarchy = node._enabled && this.enabled;
    if (node._enabledInHierarchy !== enabledInHierarchy) {
      node._enabledInHierarchy = enabledInHierarchy;

      // propagate the change to the children - necessary if we reparent a node
      // under a parent with a different enabled state (if we reparent a node that is
      // not active in the hierarchy under a parent who is active in the hierarchy then
      // we want our node to be activated)
      node._notifyHierarchyStateChanged(node, enabledInHierarchy);
    }

    // The graph depth of the child and all of its descendants will now change
    node._updateGraphDepth();

    // The child (plus subhierarchy) will need world transforms to be recalculated
    node._dirtifyWorld();
    // node might be already marked as dirty, in that case the whole chain stays frozen, so let's enforce unfreeze
    if (this._frozen) node._unfreezeParentToRoot();

    // alert an entity hierarchy that it has been inserted
    node._fireOnHierarchy('insert', 'inserthierarchy', this);

    // alert the parent that it has had a child inserted
    if (this.fire) this.fire('childinsert', node);
  }

  /**
   * Recurse the hierarchy and update the graph depth at each node.
   *
   * @private
   */
  _updateGraphDepth() {
    this._graphDepth = this._parent ? this._parent._graphDepth + 1 : 0;
    for (let i = 0, len = this._children.length; i < len; i++) {
      this._children[i]._updateGraphDepth();
    }
  }

  /**
   * Remove the node from the child list and update the parent value of the child.
   *
   * @param {GraphNode} child - The node to remove.
   * @example
   * const child = this.entity.children[0];
   * this.entity.removeChild(child);
   */
  removeChild(child) {
    const index = this._children.indexOf(child);
    if (index === -1) {
      return;
    }

    // Remove from child list
    this._children.splice(index, 1);

    // Clear parent
    child._parent = null;

    // NOTE: see PR #4047 - this fix is removed for now as it breaks other things
    // notify the child hierarchy it has been removed from the parent,
    // which marks them as not enabled in hierarchy
    // if (child._enabledInHierarchy) {
    //     child._notifyHierarchyStateChanged(child, false);
    // }

    // alert children that they has been removed
    child._fireOnHierarchy('remove', 'removehierarchy', this);

    // alert the parent that it has had a child removed
    this.fire('childremove', child);
  }
  _sync() {
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this._dirtyLocal = false;
    }
    if (this._dirtyWorld) {
      if (this._parent === null) {
        this.worldTransform.copy(this.localTransform);
      } else {
        if (this.scaleCompensation) {
          let parentWorldScale;
          const parent = this._parent;

          // Find a parent of the first uncompensated node up in the hierarchy and use its scale * localScale
          let scale = this.localScale;
          let parentToUseScaleFrom = parent; // current parent
          if (parentToUseScaleFrom) {
            while (parentToUseScaleFrom && parentToUseScaleFrom.scaleCompensation) {
              parentToUseScaleFrom = parentToUseScaleFrom._parent;
            }
            // topmost node with scale compensation
            if (parentToUseScaleFrom) {
              parentToUseScaleFrom = parentToUseScaleFrom._parent; // node without scale compensation
              if (parentToUseScaleFrom) {
                parentWorldScale = parentToUseScaleFrom.worldTransform.getScale();
                scaleCompensateScale.mul2(parentWorldScale, this.localScale);
                scale = scaleCompensateScale;
              }
            }
          }

          // Rotation is as usual
          scaleCompensateRot2.setFromMat4(parent.worldTransform);
          scaleCompensateRot.mul2(scaleCompensateRot2, this.localRotation);

          // Find matrix to transform position
          let tmatrix = parent.worldTransform;
          if (parent.scaleCompensation) {
            scaleCompensateScaleForParent.mul2(parentWorldScale, parent.getLocalScale());
            scaleCompensatePosTransform.setTRS(parent.worldTransform.getTranslation(scaleCompensatePos), scaleCompensateRot2, scaleCompensateScaleForParent);
            tmatrix = scaleCompensatePosTransform;
          }
          tmatrix.transformPoint(this.localPosition, scaleCompensatePos);
          this.worldTransform.setTRS(scaleCompensatePos, scaleCompensateRot, scale);
        } else {
          this.worldTransform.mulAffine2(this._parent.worldTransform, this.localTransform);
        }
      }
      this._dirtyWorld = false;
    }
  }

  /**
   * Updates the world transformation matrices at this node and all of its descendants.
   *
   * @ignore
   */
  syncHierarchy() {
    if (!this._enabled) return;
    if (this._frozen) return;
    this._frozen = true;
    if (this._dirtyLocal || this._dirtyWorld) {
      this._sync();
    }
    const children = this._children;
    for (let i = 0, len = children.length; i < len; i++) {
      children[i].syncHierarchy();
    }
  }

  /**
   * Reorients the graph node so that the negative z-axis points towards the target. This
   * function has two valid signatures. Either pass 3D vectors for the look at coordinate and up
   * vector, or pass numbers to represent the vectors.
   *
   * @param {Vec3|number} x - If passing a 3D vector, this is the world-space coordinate to look at.
   * Otherwise, it is the x-component of the world-space coordinate to look at.
   * @param {Vec3|number} [y] - If passing a 3D vector, this is the world-space up vector for look at
   * transform. Otherwise, it is the y-component of the world-space coordinate to look at.
   * @param {number} [z] - Z-component of the world-space coordinate to look at.
   * @param {number} [ux] - X-component of the up vector for the look at transform. Defaults to 0.
   * @param {number} [uy] - Y-component of the up vector for the look at transform. Defaults to 1.
   * @param {number} [uz] - Z-component of the up vector for the look at transform. Defaults to 0.
   * @example
   * // Look at another entity, using the (default) positive y-axis for up
   * const position = otherEntity.getPosition();
   * this.entity.lookAt(position);
   * @example
   * // Look at another entity, using the negative world y-axis for up
   * const position = otherEntity.getPosition();
   * this.entity.lookAt(position, pc.Vec3.DOWN);
   * @example
   * // Look at the world space origin, using the (default) positive y-axis for up
   * this.entity.lookAt(0, 0, 0);
   * @example
   * // Look at world-space coordinate [10, 10, 10], using the negative world y-axis for up
   * this.entity.lookAt(10, 10, 10, 0, -1, 0);
   */
  lookAt(x, y, z, ux = 0, uy = 1, uz = 0) {
    if (x instanceof Vec3) {
      target.copy(x);
      if (y instanceof Vec3) {
        // vec3, vec3
        up.copy(y);
      } else {
        // vec3
        up.copy(Vec3.UP);
      }
    } else if (z === undefined) {
      return;
    } else {
      target.set(x, y, z);
      up.set(ux, uy, uz);
    }
    matrix.setLookAt(this.getPosition(), target, up);
    rotation.setFromMat4(matrix);
    this.setRotation(rotation);
  }

  /**
   * Translates the graph node in world-space by the specified translation vector. This function
   * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
   * world-space translation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding world-space translation or
   * x-coordinate of world-space translation.
   * @param {number} [y] - Y-coordinate of world-space translation.
   * @param {number} [z] - Z-coordinate of world-space translation.
   * @example
   * // Translate via 3 numbers
   * this.entity.translate(10, 0, 0);
   * @example
   * // Translate via vector
   * const t = new pc.Vec3(10, 0, 0);
   * this.entity.translate(t);
   */
  translate(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }
    position.add(this.getPosition());
    this.setPosition(position);
  }

  /**
   * Translates the graph node in local-space by the specified translation vector. This function
   * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
   * local-space translation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space translation or
   * x-coordinate of local-space translation.
   * @param {number} [y] - Y-coordinate of local-space translation.
   * @param {number} [z] - Z-coordinate of local-space translation.
   * @example
   * // Translate via 3 numbers
   * this.entity.translateLocal(10, 0, 0);
   * @example
   * // Translate via vector
   * const t = new pc.Vec3(10, 0, 0);
   * this.entity.translateLocal(t);
   */
  translateLocal(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }
    this.localRotation.transformVector(position, position);
    this.localPosition.add(position);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Rotates the graph node in world-space by the specified Euler angles. Eulers are specified in
   * degrees in XYZ order. This function has two valid signatures: you can either pass a 3D
   * vector or 3 numbers to specify the world-space rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding world-space rotation or
   * rotation around world-space x-axis in degrees.
   * @param {number} [y] - Rotation around world-space y-axis in degrees.
   * @param {number} [z] - Rotation around world-space z-axis in degrees.
   * @example
   * // Rotate via 3 numbers
   * this.entity.rotate(0, 90, 0);
   * @example
   * // Rotate via vector
   * const r = new pc.Vec3(0, 90, 0);
   * this.entity.rotate(r);
   */
  rotate(x, y, z) {
    rotation.setFromEulerAngles(x, y, z);
    if (this._parent === null) {
      this.localRotation.mul2(rotation, this.localRotation);
    } else {
      const rot = this.getRotation();
      const parentRot = this._parent.getRotation();
      invParentRot.copy(parentRot).invert();
      rotation.mul2(invParentRot, rotation);
      this.localRotation.mul2(rotation, rot);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Rotates the graph node in local-space by the specified Euler angles. Eulers are specified in
   * degrees in XYZ order. This function has two valid signatures: you can either pass a 3D
   * vector or 3 numbers to specify the local-space rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space rotation or
   * rotation around local-space x-axis in degrees.
   * @param {number} [y] - Rotation around local-space y-axis in degrees.
   * @param {number} [z] - Rotation around local-space z-axis in degrees.
   * @example
   * // Rotate via 3 numbers
   * this.entity.rotateLocal(0, 90, 0);
   * @example
   * // Rotate via vector
   * const r = new pc.Vec3(0, 90, 0);
   * this.entity.rotateLocal(r);
   */
  rotateLocal(x, y, z) {
    rotation.setFromEulerAngles(x, y, z);
    this.localRotation.mul(rotation);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }
}

export { GraphNode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuY29uc3Qgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvcyA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBNYXQ0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRtcFF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbmNvbnN0IGludlBhcmVudFJvdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuY29uc3QgdGFyZ2V0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHVwID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCBoYW5kbGVzIHNpZ25hdHVyZSBvdmVybG9hZGluZyB0byByZWNlaXZlIGEgdGVzdCBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0ZpbmROb2RlQ2FsbGJhY2t8c3RyaW5nfSBhdHRyIC0gQXR0cmlidXRlIG9yIGxhbWJkYS5cbiAqIEBwYXJhbSB7Kn0gW3ZhbHVlXSAtIE9wdGlvbmFsIHZhbHVlIGluIGNhc2Ugb2YgYGF0dHJgIGJlaW5nIGEgYHN0cmluZ2BcbiAqIEByZXR1cm5zIHtGaW5kTm9kZUNhbGxiYWNrfSBUZXN0IGZ1bmN0aW9uIHRoYXQgcmVjZWl2ZXMgYSBHcmFwaE5vZGUgYW5kIHJldHVybnMgYSBib29sZWFuLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBjcmVhdGVUZXN0KGF0dHIsIHZhbHVlKSB7XG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICByZXR1cm4gYXR0cjtcbiAgICB9XG4gICAgcmV0dXJuIChub2RlKSA9PiB7XG4gICAgICAgIGxldCB4ID0gbm9kZVthdHRyXTtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgeCA9IHgoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geCA9PT0gdmFsdWU7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gcmVjdXJzZSBmaW5kT25lIHdpdGhvdXQgY2FsbGluZyBjcmVhdGVUZXN0IGNvbnN0YW50bHkuXG4gKlxuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBDdXJyZW50IG5vZGUuXG4gKiBAcGFyYW0ge0ZpbmROb2RlQ2FsbGJhY2t9IHRlc3QgLSBUZXN0IGZ1bmN0aW9uLlxuICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBBIGdyYXBoIG5vZGUgdGhhdCBtYXRjaGVzIHRoZSBzZWFyY2ggY3JpdGVyaWEuIFJldHVybnMgbnVsbCBpZiBub1xuICogbm9kZSBpcyBmb3VuZC5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZmluZE5vZGUobm9kZSwgdGVzdCkge1xuICAgIGlmICh0ZXN0KG5vZGUpKVxuICAgICAgICByZXR1cm4gbm9kZTtcblxuICAgIGNvbnN0IGNoaWxkcmVuID0gbm9kZS5fY2hpbGRyZW47XG4gICAgY29uc3QgbGVuID0gY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZmluZE5vZGUoY2hpbGRyZW5baV0sIHRlc3QpO1xuICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZmluZH0gYW5kIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0gdG8gc2VhcmNoIHRocm91Z2ggYSBncmFwaFxuICogbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmluZE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybmluZyBgdHJ1ZWAgd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAqIHtAbGluayBHcmFwaE5vZGUjZmluZH0gb3Ige0BsaW5rIEdyYXBoTm9kZSNmaW5kT25lfS5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEdyYXBoTm9kZSNmb3JFYWNofSB0byBpdGVyYXRlIHRocm91Z2ggYSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzXG4gKiBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRm9yRWFjaE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICovXG5cbi8qKlxuICogQSBoaWVyYXJjaGljYWwgc2NlbmUgbm9kZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoTm9kZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIG5vbi11bmlxdWUgbmFtZSBvZiBhIGdyYXBoIG5vZGUuIERlZmF1bHRzIHRvICdVbnRpdGxlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcmZhY2UgZm9yIHRhZ2dpbmcgZ3JhcGggbm9kZXMuIFRhZyBiYXNlZCBzZWFyY2hlcyBjYW4gYmUgcGVyZm9ybWVkIHVzaW5nIHRoZVxuICAgICAqIHtAbGluayBHcmFwaE5vZGUjZmluZEJ5VGFnfSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtUYWdzfVxuICAgICAqL1xuICAgIHRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sYWJlbHMgPSB7fTtcblxuICAgIC8vIExvY2FsLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtIChvbmx5IGZpcnN0IDMgYXJlIHNldHRhYmxlIGJ5IHRoZSB1c2VyKVxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsb2NhbFNjYWxlID0gbmV3IFZlYzMoMSwgMSwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvY2FsRXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpOyAvLyBPbmx5IGNhbGN1bGF0ZWQgb24gcmVxdWVzdFxuXG4gICAgLy8gV29ybGQtc3BhY2UgcHJvcGVydGllcyBvZiB0cmFuc2Zvcm1cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBldWxlckFuZ2xlcyA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NjYWxlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlydHlMb2NhbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hYWJiVmVyID0gMDtcblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBub2RlIHRvIGlnbm9yZSBoaWVyYXJjaHkgc3luYyBlbnRpcmVseSAoaW5jbHVkaW5nIGNoaWxkcmVuIG5vZGVzKS4gVGhlIGVuZ2luZSBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBmcmVlemVzIGFuZCB1bmZyZWV6ZXMgb2JqZWN0cyB3aGVuZXZlciByZXF1aXJlZC4gU2VncmVnYXRpbmcgZHluYW1pYyBhbmRcbiAgICAgKiBzdGF0aW9uYXJ5IG5vZGVzIGludG8gc3ViaGllcmFyY2hpZXMgYWxsb3dzIHRvIHJlZHVjZSBzeW5jIHRpbWUgc2lnbmlmaWNhbnRseS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Zyb3plbiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB3b3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eVdvcmxkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDYWNoZWQgdmFsdWUgcmVwcmVzZW50aW5nIHRoZSBuZWdhdGl2ZWx5IHNjYWxlZCB3b3JsZCB0cmFuc2Zvcm0uIElmIHRoZSB2YWx1ZSBpcyAwLCB0aGlzXG4gICAgICogbWFya3MgdGhpcyB2YWx1ZSBhcyBkaXJ0eSBhbmQgaXQgbmVlZHMgdG8gYmUgcmVjYWxjdWxhdGVkLiBJZiB0aGUgdmFsdWUgaXMgMSwgdGhlIHdvcmxkXG4gICAgICogdHJhbnNmb3JtIGlzIG5vdCBuZWdhdGl2ZWx5IHNjYWxlZC4gSWYgdGhlIHZhbHVlIGlzIC0xLCB0aGUgd29ybGQgdHJhbnNmb3JtIGlzIG5lZ2F0aXZlbHlcbiAgICAgKiBzY2FsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dvcmxkU2NhbGVTaWduID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vcm1hbE1hdHJpeCA9IG5ldyBNYXQzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eU5vcm1hbCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JpZ2h0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXAgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9mb3J3YXJkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJlbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NoaWxkcmVuID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dyYXBoRGVwdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogUmVwcmVzZW50cyBlbmFibGVkIHN0YXRlIG9mIHRoZSBlbnRpdHkuIElmIHRoZSBlbnRpdHkgaXMgZGlzYWJsZWQsIHRoZSBlbnRpdHkgaW5jbHVkaW5nIGFsbFxuICAgICAqIGNoaWxkcmVuIGFyZSBleGNsdWRlZCBmcm9tIHVwZGF0ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFJlcHJlc2VudHMgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IGluIHRoZSBoaWVyYXJjaHkuIEl0J3MgdHJ1ZSBvbmx5IGlmIHRoaXMgZW50aXR5IGFuZFxuICAgICAqIGFsbCBwYXJlbnQgZW50aXRpZXMgYWxsIHRoZSB3YXkgdG8gdGhlIHNjZW5lJ3Mgcm9vdCBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNjYWxlQ29tcGVuc2F0aW9uID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR3JhcGhOb2RlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBub24tdW5pcXVlIG5hbWUgb2YgYSBncmFwaCBub2RlLiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUgPSAnVW50aXRsZWQnKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBYLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHJpZ2h0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9yaWdodCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRYKHRoaXMuX3JpZ2h0KS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBZLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHVwKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3VwKSB7XG4gICAgICAgICAgICB0aGlzLl91cCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRZKHRoaXMuX3VwKS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBuZWdhdGl2ZSBaLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IGZvcndhcmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZm9yd2FyZCkge1xuICAgICAgICAgICAgdGhpcy5fZm9yd2FyZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRaKHRoaXMuX2ZvcndhcmQpLm5vcm1hbGl6ZSgpLm11bFNjYWxhcigtMSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBtYXRyaXggdXNlZCB0byB0cmFuc2Zvcm0gdGhlIG5vcm1hbC5cbiAgICAgKlxuICAgICAqIEB0eXBlICB7TWF0M31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IG5vcm1hbE1hdHJpeCgpIHtcblxuICAgICAgICBjb25zdCBub3JtYWxNYXQgPSB0aGlzLl9ub3JtYWxNYXRyaXg7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eU5vcm1hbCkge1xuICAgICAgICAgICAgbm9ybWFsTWF0LmludmVydE1hdDQodGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpKS50cmFuc3Bvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9ybWFsTWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSBvciBkaXNhYmxlIGEgR3JhcGhOb2RlLiBJZiBvbmUgb2YgdGhlIEdyYXBoTm9kZSdzIHBhcmVudHMgaXMgZGlzYWJsZWQgdGhlcmUgd2lsbCBiZVxuICAgICAqIG5vIG90aGVyIHNpZGUgZWZmZWN0cy4gSWYgYWxsIHRoZSBwYXJlbnRzIGFyZSBlbmFibGVkIHRoZW4gdGhlIG5ldyB2YWx1ZSB3aWxsIGFjdGl2YXRlIG9yXG4gICAgICogZGVhY3RpdmF0ZSBhbGwgdGhlIGVuYWJsZWQgY2hpbGRyZW4gb2YgdGhlIEdyYXBoTm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKGVuYWJsZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IGVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXG4gICAgICAgICAgICAvLyBpZiBlbmFibGluZyBlbnRpdHksIG1ha2UgYWxsIGNoaWxkcmVuIGVuYWJsZWQgaW4gaGllcmFyY2h5IG9ubHkgd2hlbiB0aGUgcGFyZW50IGlzIGFzIHdlbGxcbiAgICAgICAgICAgIC8vIGlmIGRpc2FibGluZyBlbnRpdHksIG1ha2UgYWxsIGNoaWxkcmVuIGRpc2FibGVkIGluIGhpZXJhcmNoeSBpbiBhbGwgY2FzZXNcbiAgICAgICAgICAgIGlmIChlbmFibGVkICYmIHRoaXMuX3BhcmVudD8uZW5hYmxlZCB8fCAhZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCh0aGlzLCBlbmFibGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICAvLyBtYWtlIHN1cmUgdG8gY2hlY2sgdGhpcy5fZW5hYmxlZCB0b28gYmVjYXVzZSBpZiB0aGF0XG4gICAgICAgIC8vIHdhcyBmYWxzZSB3aGVuIGEgcGFyZW50IHdhcyB1cGRhdGVkIHRoZSBfZW5hYmxlZEluSGllcmFyY2h5XG4gICAgICAgIC8vIGZsYWcgbWF5IG5vdCBoYXZlIGJlZW4gdXBkYXRlZCBmb3Igb3B0aW1pemF0aW9uIHB1cnBvc2VzXG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkICYmIHRoaXMuX2VuYWJsZWRJbkhpZXJhcmNoeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgYSBwYXJlbnQgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgcGFyZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgcGF0aCBvZiB0aGUgZ3JhcGggbm9kZSByZWxhdGl2ZSB0byB0aGUgcm9vdCBvZiB0aGUgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgICAgbGV0IG5vZGUgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMubmFtZTtcbiAgICAgICAgd2hpbGUgKG5vZGUgJiYgbm9kZS5fcGFyZW50KSB7XG4gICAgICAgICAgICByZXN1bHQgPSBgJHtub2RlLm5hbWV9LyR7cmVzdWx0fWA7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IGhpZ2hlc3QgZ3JhcGggbm9kZSBmcm9tIGN1cnJlbnQgbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV9XG4gICAgICovXG4gICAgZ2V0IHJvb3QoKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzO1xuICAgICAgICB3aGlsZSAocmVzdWx0Ll9wYXJlbnQpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBjaGlsZHJlbiBvZiB0aGlzIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlW119XG4gICAgICovXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2hpbGRyZW47XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBkZXB0aCBvZiB0aGlzIGNoaWxkIHdpdGhpbiB0aGUgZ3JhcGguIE5vdGUgdGhhdCBmb3JcbiAgICAgKiBwZXJmb3JtYW5jZSByZWFzb25zIHRoaXMgaXMgb25seSByZWNhbGN1bGF0ZWQgd2hlbiBhIG5vZGUgaXMgYWRkZWQgdG8gYSBuZXcgcGFyZW50LCBpLmUuIEl0XG4gICAgICogaXMgbm90IHJlY2FsY3VsYXRlZCB3aGVuIGEgbm9kZSBpcyBzaW1wbHkgcmVtb3ZlZCBmcm9tIHRoZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGdyYXBoRGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncmFwaERlcHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gR3JhcGggbm9kZSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gVHJ1ZSBpZiBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHksIGZhbHNlIGlmIGRpc2FibGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkKSB7XG4gICAgICAgIG5vZGUuX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkKGVuYWJsZWQpO1xuXG4gICAgICAgIGNvbnN0IGMgPSBub2RlLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjW2ldLl9lbmFibGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjW2ldLCBlbmFibGVkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBlbmFibGVkIGZsYWcgb2YgdGhlIGVudGl0eSBvciBvbmUgb2YgaXRzIHBhcmVudHMgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5LCBmYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKSB7XG4gICAgICAgIC8vIE92ZXJyaWRlIGluIGRlcml2ZWQgY2xhc3Nlc1xuICAgICAgICB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBlbmFibGVkO1xuICAgICAgICBpZiAoZW5hYmxlZCAmJiAhdGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgdGhpcy5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3RoaXN9IGNsb25lIC0gVGhlIGNsb25lZCBncmFwaCBub2RlIHRvIGNvcHkgaW50by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbG9uZUludGVybmFsKGNsb25lKSB7XG4gICAgICAgIGNsb25lLm5hbWUgPSB0aGlzLm5hbWU7XG5cbiAgICAgICAgY29uc3QgdGFncyA9IHRoaXMudGFncy5fbGlzdDtcbiAgICAgICAgY2xvbmUudGFncy5jbGVhcigpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhZ3MubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBjbG9uZS50YWdzLmFkZCh0YWdzW2ldKTtcblxuICAgICAgICBjbG9uZS5fbGFiZWxzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fbGFiZWxzKTtcblxuICAgICAgICBjbG9uZS5sb2NhbFBvc2l0aW9uLmNvcHkodGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgY2xvbmUubG9jYWxSb3RhdGlvbi5jb3B5KHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIGNsb25lLmxvY2FsU2NhbGUuY29weSh0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICBjbG9uZS5sb2NhbEV1bGVyQW5nbGVzLmNvcHkodGhpcy5sb2NhbEV1bGVyQW5nbGVzKTtcblxuICAgICAgICBjbG9uZS5wb3NpdGlvbi5jb3B5KHRoaXMucG9zaXRpb24pO1xuICAgICAgICBjbG9uZS5yb3RhdGlvbi5jb3B5KHRoaXMucm90YXRpb24pO1xuICAgICAgICBjbG9uZS5ldWxlckFuZ2xlcy5jb3B5KHRoaXMuZXVsZXJBbmdsZXMpO1xuXG4gICAgICAgIGNsb25lLmxvY2FsVHJhbnNmb3JtLmNvcHkodGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgIGNsb25lLl9kaXJ0eUxvY2FsID0gdGhpcy5fZGlydHlMb2NhbDtcblxuICAgICAgICBjbG9uZS53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMud29ybGRUcmFuc2Zvcm0pO1xuICAgICAgICBjbG9uZS5fZGlydHlXb3JsZCA9IHRoaXMuX2RpcnR5V29ybGQ7XG4gICAgICAgIGNsb25lLl9kaXJ0eU5vcm1hbCA9IHRoaXMuX2RpcnR5Tm9ybWFsO1xuICAgICAgICBjbG9uZS5fYWFiYlZlciA9IHRoaXMuX2FhYmJWZXIgKyAxO1xuXG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICBjbG9uZS5zY2FsZUNvbXBlbnNhdGlvbiA9IHRoaXMuc2NhbGVDb21wZW5zYXRpb247XG5cbiAgICAgICAgLy8gZmFsc2UgYXMgdGhpcyBub2RlIGlzIG5vdCBpbiB0aGUgaGllcmFyY2h5IHlldFxuICAgICAgICBjbG9uZS5fZW5hYmxlZEluSGllcmFyY2h5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgYSBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgY2xvbmUgb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBjbG9uZSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgIHRoaXMuX2Nsb25lSW50ZXJuYWwoY2xvbmUpO1xuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29weSBhIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gc291cmNlIC0gVGhlIGdyYXBoIG5vZGUgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfSBUaGUgZGVzdGluYXRpb24gZ3JhcGggbm9kZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgc291cmNlLl9jbG9uZUludGVybmFsKHRoaXMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIERldGFjaCBhIEdyYXBoTm9kZSBmcm9tIHRoZSBoaWVyYXJjaHkgYW5kIHJlY3Vyc2l2ZWx5IGRlc3Ryb3kgYWxsIGNoaWxkcmVuLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBmaXJzdENoaWxkID0gdGhpcy5lbnRpdHkuY2hpbGRyZW5bMF07XG4gICAgICogZmlyc3RDaGlsZC5kZXN0cm95KCk7IC8vIGRlbGV0ZSBjaGlsZCwgYWxsIGNvbXBvbmVudHMgYW5kIHJlbW92ZSBmcm9tIGhpZXJhcmNoeVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIERldGFjaCBmcm9tIHBhcmVudFxuICAgICAgICB0aGlzLnJlbW92ZSgpO1xuXG4gICAgICAgIC8vIFJlY3Vyc2l2ZWx5IGRlc3Ryb3kgYWxsIGNoaWxkcmVuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIHdoaWxlIChjaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBsYXN0IGNoaWxkIGZyb20gdGhlIGFycmF5XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkcmVuLnBvcCgpO1xuICAgICAgICAgICAgLy8gRGlzY29ubmVjdCBpdCBmcm9tIHRoZSBwYXJlbnQ6IHRoaXMgaXMgb25seSBhbiBvcHRpbWl6YXRpb24gc3RlcCwgdG8gcHJldmVudCBjYWxsaW5nXG4gICAgICAgICAgICAvLyBHcmFwaE5vZGUjcmVtb3ZlQ2hpbGQgd2hpY2ggd291bGQgdHJ5IHRvIHJlZmluZCBpdCB2aWEgdGhpcy5fY2hpbGRyZW4uaW5kZXhPZiAod2hpY2hcbiAgICAgICAgICAgIC8vIHdpbGwgZmFpbCwgYmVjYXVzZSB3ZSBqdXN0IHJlbW92ZWQgaXQpLlxuICAgICAgICAgICAgY2hpbGQuX3BhcmVudCA9IG51bGw7XG4gICAgICAgICAgICBjaGlsZC5kZXN0cm95KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmaXJlIGRlc3Ryb3kgZXZlbnRcbiAgICAgICAgdGhpcy5maXJlKCdkZXN0cm95JywgdGhpcyk7XG5cbiAgICAgICAgLy8gY2xlYXIgYWxsIGV2ZW50c1xuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZ3JhcGggbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyBmb3IgdGhlIG5vZGVzIHRoYXQgc2F0aXNmeSBzb21lIHNlYXJjaFxuICAgICAqIGNyaXRlcmlhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaW5kTm9kZUNhbGxiYWNrfHN0cmluZ30gYXR0ciAtIFRoaXMgY2FuIGVpdGhlciBiZSBhIGZ1bmN0aW9uIG9yIGEgc3RyaW5nLiBJZiBpdCdzIGFcbiAgICAgKiBmdW5jdGlvbiwgaXQgaXMgZXhlY3V0ZWQgZm9yIGVhY2ggZGVzY2VuZGFudCBub2RlIHRvIHRlc3QgaWYgbm9kZSBzYXRpc2ZpZXMgdGhlIHNlYXJjaFxuICAgICAqIGxvZ2ljLiBSZXR1cm5pbmcgdHJ1ZSBmcm9tIHRoZSBmdW5jdGlvbiB3aWxsIGluY2x1ZGUgdGhlIG5vZGUgaW50byB0aGUgcmVzdWx0cy4gSWYgaXQncyBhXG4gICAgICogc3RyaW5nIHRoZW4gaXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiBhIGZpZWxkIG9yIGEgbWV0aG9kIG9mIHRoZSBub2RlLiBJZiB0aGlzIGlzIHRoZSBuYW1lXG4gICAgICogb2YgYSBmaWVsZCB0aGVuIHRoZSB2YWx1ZSBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB3aWxsIGJlIGNoZWNrZWQgZm9yIGVxdWFsaXR5LiBJZlxuICAgICAqIHRoaXMgaXMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiB0aGVuIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2hlY2tlZCBmb3JcbiAgICAgKiBlcXVhbGl0eSBhZ2FpbnN0IHRoZSB2YWx1ZWQgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgdG8gdGhpcyBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3ZhbHVlXSAtIElmIHRoZSBmaXJzdCBhcmd1bWVudCAoYXR0cikgaXMgYSBwcm9wZXJ0eSBuYW1lIHRoZW4gdGhpcyB2YWx1ZVxuICAgICAqIHdpbGwgYmUgY2hlY2tlZCBhZ2FpbnN0IHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZVtdfSBUaGUgYXJyYXkgb2YgZ3JhcGggbm9kZXMgdGhhdCBtYXRjaCB0aGUgc2VhcmNoIGNyaXRlcmlhLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgYWxsIG5vZGVzIHRoYXQgaGF2ZSBhIG1vZGVsIGNvbXBvbmVudCBhbmQgaGF2ZSAnZG9vcicgaW4gdGhlaXIgbG93ZXItY2FzZWQgbmFtZVxuICAgICAqIGNvbnN0IGRvb3JzID0gaG91c2UuZmluZChmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICByZXR1cm4gbm9kZS5tb2RlbCAmJiBub2RlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdkb29yJykgIT09IC0xO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgYWxsIG5vZGVzIHRoYXQgaGF2ZSB0aGUgbmFtZSBwcm9wZXJ0eSBzZXQgdG8gJ1Rlc3QnXG4gICAgICogY29uc3QgZW50aXRpZXMgPSBwYXJlbnQuZmluZCgnbmFtZScsICdUZXN0Jyk7XG4gICAgICovXG4gICAgZmluZChhdHRyLCB2YWx1ZSkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgICAgIGNvbnN0IHRlc3QgPSBjcmVhdGVUZXN0KGF0dHIsIHZhbHVlKTtcblxuICAgICAgICB0aGlzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0ZXN0KG5vZGUpKVxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChub2RlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciB0aGUgZmlyc3Qgbm9kZSB0aGF0IHNhdGlzZmllcyBzb21lXG4gICAgICogc2VhcmNoIGNyaXRlcmlhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaW5kTm9kZUNhbGxiYWNrfHN0cmluZ30gYXR0ciAtIFRoaXMgY2FuIGVpdGhlciBiZSBhIGZ1bmN0aW9uIG9yIGEgc3RyaW5nLiBJZiBpdCdzIGFcbiAgICAgKiBmdW5jdGlvbiwgaXQgaXMgZXhlY3V0ZWQgZm9yIGVhY2ggZGVzY2VuZGFudCBub2RlIHRvIHRlc3QgaWYgbm9kZSBzYXRpc2ZpZXMgdGhlIHNlYXJjaFxuICAgICAqIGxvZ2ljLiBSZXR1cm5pbmcgdHJ1ZSBmcm9tIHRoZSBmdW5jdGlvbiB3aWxsIHJlc3VsdCBpbiB0aGF0IG5vZGUgYmVpbmcgcmV0dXJuZWQgZnJvbVxuICAgICAqIGZpbmRPbmUuIElmIGl0J3MgYSBzdHJpbmcgdGhlbiBpdCByZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgZmllbGQgb3IgYSBtZXRob2Qgb2YgdGhlIG5vZGUuIElmXG4gICAgICogdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZpZWxkIHRoZW4gdGhlIHZhbHVlIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHdpbGwgYmUgY2hlY2tlZCBmb3JcbiAgICAgKiBlcXVhbGl0eS4gSWYgdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIHRoZW4gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZVxuICAgICAqIGNoZWNrZWQgZm9yIGVxdWFsaXR5IGFnYWluc3QgdGhlIHZhbHVlZCBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB0byB0aGlzIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdmFsdWVdIC0gSWYgdGhlIGZpcnN0IGFyZ3VtZW50IChhdHRyKSBpcyBhIHByb3BlcnR5IG5hbWUgdGhlbiB0aGlzIHZhbHVlXG4gICAgICogd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IEEgZ3JhcGggbm9kZSB0aGF0IG1hdGNoIHRoZSBzZWFyY2ggY3JpdGVyaWEuIFJldHVybnMgbnVsbCBpZiBub1xuICAgICAqIG5vZGUgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kIHRoZSBmaXJzdCBub2RlIHRoYXQgaXMgY2FsbGVkICdoZWFkJyBhbmQgaGFzIGEgbW9kZWwgY29tcG9uZW50XG4gICAgICogY29uc3QgaGVhZCA9IHBsYXllci5maW5kT25lKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZSA9PT0gJ2hlYWQnO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgdGhlIGZpcnN0IG5vZGUgdGhhdCBoYXMgdGhlIG5hbWUgcHJvcGVydHkgc2V0IHRvICdUZXN0J1xuICAgICAqIGNvbnN0IG5vZGUgPSBwYXJlbnQuZmluZE9uZSgnbmFtZScsICdUZXN0Jyk7XG4gICAgICovXG4gICAgZmluZE9uZShhdHRyLCB2YWx1ZSkge1xuICAgICAgICBjb25zdCB0ZXN0ID0gY3JlYXRlVGVzdChhdHRyLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBmaW5kTm9kZSh0aGlzLCB0ZXN0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIGdyYXBoIG5vZGVzIHRoYXQgc2F0aXNmeSB0aGUgc2VhcmNoIHF1ZXJ5LiBRdWVyeSBjYW4gYmUgc2ltcGx5IGEgc3RyaW5nLCBvciBjb21tYVxuICAgICAqIHNlcGFyYXRlZCBzdHJpbmdzLCB0byBoYXZlIGluY2x1c2l2ZSByZXN1bHRzIG9mIGFzc2V0cyB0aGF0IG1hdGNoIGF0IGxlYXN0IG9uZSBxdWVyeS4gQVxuICAgICAqIHF1ZXJ5IHRoYXQgY29uc2lzdHMgb2YgYW4gYXJyYXkgb2YgdGFncyBjYW4gYmUgdXNlZCB0byBtYXRjaCBncmFwaCBub2RlcyB0aGF0IGhhdmUgZWFjaCB0YWdcbiAgICAgKiBvZiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Li4uKn0gcXVlcnkgLSBOYW1lIG9mIGEgdGFnIG9yIGFycmF5IG9mIHRhZ3MuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZVtdfSBBIGxpc3Qgb2YgYWxsIGdyYXBoIG5vZGVzIHRoYXQgbWF0Y2ggdGhlIHF1ZXJ5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHRhZ2dlZCBieSBgYW5pbWFsYFxuICAgICAqIGNvbnN0IGFuaW1hbHMgPSBub2RlLmZpbmRCeVRhZyhcImFuaW1hbFwiKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCB0YWdnZWQgYnkgYGJpcmRgIE9SIGBtYW1tYWxgXG4gICAgICogY29uc3QgYmlyZHNBbmRNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoXCJiaXJkXCIsIFwibWFtbWFsXCIpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgXG4gICAgICogY29uc3QgbWVhdEVhdGluZ01hbW1hbHMgPSBub2RlLmZpbmRCeVRhZyhbXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIl0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgKGBjYXJuaXZvcmVgIEFORCBgbWFtbWFsYCkgT1IgKGBjYXJuaXZvcmVgIEFORCBgcmVwdGlsZWApXG4gICAgICogY29uc3QgbWVhdEVhdGluZ01hbW1hbHNBbmRSZXB0aWxlcyA9IG5vZGUuZmluZEJ5VGFnKFtcImNhcm5pdm9yZVwiLCBcIm1hbW1hbFwiXSwgW1wiY2Fybml2b3JlXCIsIFwicmVwdGlsZVwiXSk7XG4gICAgICovXG4gICAgZmluZEJ5VGFnKCkge1xuICAgICAgICBjb25zdCBxdWVyeSA9IGFyZ3VtZW50cztcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGNvbnN0IHF1ZXJ5Tm9kZSA9IChub2RlLCBjaGVja05vZGUpID0+IHtcbiAgICAgICAgICAgIGlmIChjaGVja05vZGUgJiYgbm9kZS50YWdzLmhhcyguLi5xdWVyeSkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBxdWVyeU5vZGUobm9kZS5fY2hpbGRyZW5baV0sIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHF1ZXJ5Tm9kZSh0aGlzLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBmaXJzdCBub2RlIGZvdW5kIGluIHRoZSBncmFwaCB3aXRoIHRoZSBuYW1lLiBUaGUgc2VhcmNoIGlzIGRlcHRoIGZpcnN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZ3JhcGguXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBUaGUgZmlyc3Qgbm9kZSB0byBiZSBmb3VuZCBtYXRjaGluZyB0aGUgc3VwcGxpZWQgbmFtZS4gUmV0dXJuc1xuICAgICAqIG51bGwgaWYgbm8gbm9kZSBpcyBmb3VuZC5cbiAgICAgKi9cbiAgICBmaW5kQnlOYW1lKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluZE9uZSgnbmFtZScsIG5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZmlyc3Qgbm9kZSBmb3VuZCBpbiB0aGUgZ3JhcGggYnkgaXRzIGZ1bGwgcGF0aCBpbiB0aGUgZ3JhcGguIFRoZSBmdWxsIHBhdGggaGFzIHRoaXNcbiAgICAgKiBmb3JtICdwYXJlbnQvY2hpbGQvc3ViLWNoaWxkJy4gVGhlIHNlYXJjaCBpcyBkZXB0aCBmaXJzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBwYXRoIC0gVGhlIGZ1bGwgcGF0aCBvZiB0aGUge0BsaW5rIEdyYXBoTm9kZX0gYXMgZWl0aGVyIGEgc3RyaW5nIG9yXG4gICAgICogYXJyYXkgb2Yge0BsaW5rIEdyYXBoTm9kZX0gbmFtZXMuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBUaGUgZmlyc3Qgbm9kZSB0byBiZSBmb3VuZCBtYXRjaGluZyB0aGUgc3VwcGxpZWQgcGF0aC4gUmV0dXJuc1xuICAgICAqIG51bGwgaWYgbm8gbm9kZSBpcyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFN0cmluZyBmb3JtXG4gICAgICogY29uc3QgZ3JhbmRjaGlsZCA9IHRoaXMuZW50aXR5LmZpbmRCeVBhdGgoJ2NoaWxkL2dyYW5kY2hpbGQnKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFycmF5IGZvcm1cbiAgICAgKiBjb25zdCBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aChbJ2NoaWxkJywgJ2dyYW5kY2hpbGQnXSk7XG4gICAgICovXG4gICAgZmluZEJ5UGF0aChwYXRoKSB7XG4gICAgICAgIC8vIGFjY2VwdCBlaXRoZXIgc3RyaW5nIHBhdGggd2l0aCAnLycgc2VwYXJhdG9ycyBvciBhcnJheSBvZiBwYXJ0cy5cbiAgICAgICAgY29uc3QgcGFydHMgPSBBcnJheS5pc0FycmF5KHBhdGgpID8gcGF0aCA6IHBhdGguc3BsaXQoJy8nKTtcblxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGltYXggPSBwYXJ0cy5sZW5ndGg7IGkgPCBpbWF4OyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jaGlsZHJlbi5maW5kKGMgPT4gYy5uYW1lID09PSBwYXJ0c1tpXSk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlcyBhIHByb3ZpZGVkIGZ1bmN0aW9uIG9uY2Ugb24gdGhpcyBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGb3JFYWNoTm9kZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIG9uIHRoZSBncmFwaCBub2RlIGFuZCBlYWNoXG4gICAgICogZGVzY2VuZGFudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3RoaXNBcmddIC0gT3B0aW9uYWwgdmFsdWUgdG8gdXNlIGFzIHRoaXMgd2hlbiBleGVjdXRpbmcgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb2cgdGhlIHBhdGggYW5kIG5hbWUgb2YgZWFjaCBub2RlIGluIGRlc2NlbmRhbnQgdHJlZSBzdGFydGluZyB3aXRoIFwicGFyZW50XCJcbiAgICAgKiBwYXJlbnQuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhub2RlLnBhdGggKyBcIi9cIiArIG5vZGUubmFtZSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIGNvbnN0IGxlbiA9IGNoaWxkcmVuLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgY2hpbGRyZW5baV0uZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBub2RlIGlzIGRlc2NlbmRhbnQgb2YgYW5vdGhlciBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBQb3RlbnRpYWwgYW5jZXN0b3Igb2Ygbm9kZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgbm9kZSBpcyBkZXNjZW5kYW50IG9mIGFub3RoZXIgbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChyb29mLmlzRGVzY2VuZGFudE9mKGhvdXNlKSkge1xuICAgICAqICAgICAvLyByb29mIGlzIGRlc2NlbmRhbnQgb2YgaG91c2UgZW50aXR5XG4gICAgICogfVxuICAgICAqL1xuICAgIGlzRGVzY2VuZGFudE9mKG5vZGUpIHtcbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHBhcmVudCA9PT0gbm9kZSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50Ll9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIG5vZGUgaXMgYW5jZXN0b3IgZm9yIGFub3RoZXIgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gUG90ZW50aWFsIGRlc2NlbmRhbnQgb2Ygbm9kZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgbm9kZSBpcyBhbmNlc3RvciBmb3IgYW5vdGhlciBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGJvZHkuaXNBbmNlc3Rvck9mKGZvb3QpKSB7XG4gICAgICogICAgIC8vIGZvb3QgaXMgd2l0aGluIGJvZHkncyBoaWVyYXJjaHlcbiAgICAgKiB9XG4gICAgICovXG4gICAgaXNBbmNlc3Rvck9mKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUuaXNEZXNjZW5kYW50T2YodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUgaW4gRXVsZXIgYW5nbGUgZm9ybS4gVGhlIHJvdGF0aW9uXG4gICAgICogaXMgcmV0dXJuZWQgYXMgZXVsZXIgYW5nbGVzIGluIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmVcbiAgICAgKiBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXIgdG8gc2V0IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSwgdXNlXG4gICAgICoge0BsaW5rIEdyYXBoTm9kZSNzZXRFdWxlckFuZ2xlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGluIEV1bGVyIGFuZ2xlIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRFdWxlckFuZ2xlcygpO1xuICAgICAqIGFuZ2xlcy55ID0gMTgwOyAvLyByb3RhdGUgdGhlIGVudGl0eSBhcm91bmQgWSBieSAxODAgZGVncmVlc1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRFdWxlckFuZ2xlcyh0aGlzLmV1bGVyQW5nbGVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXVsZXJBbmdsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSByb3RhdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhc1xuICAgICAqIGV1bGVyIGFuZ2xlcyBpbiBhIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvXG4gICAgICogdXBkYXRlIHRoZSBsb2NhbCByb3RhdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxFdWxlckFuZ2xlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGV1bGVyIGFuZ2xlcyBpbiBYWVogb3JkZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogYW5nbGVzLnkgPSAxODA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIGdldExvY2FsRXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5nZXRFdWxlckFuZ2xlcyh0aGlzLmxvY2FsRXVsZXJBbmdsZXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbEV1bGVyQW5nbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcG9zaXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiBwb3NpdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcG9zaXRpb24gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICogcG9zaXRpb24ueCArPSAxOyAvLyBtb3ZlIHRoZSBlbnRpdHkgMSB1bml0IGFsb25nIHguXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgZ2V0TG9jYWxQb3NpdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgUXVhdH0uIFRoZSByZXR1cm5lZCBxdWF0ZXJuaW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG8gdXBkYXRlIHRoZSBsb2NhbFxuICAgICAqIHJvdGF0aW9uLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbFJvdGF0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgbG9jYWwgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgYSBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgcm90YXRpb24gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFJvdGF0aW9uKCk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxSb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHNjYWxlIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHNjYWxlIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUbyB1cGRhdGUgdGhlIGxvY2FsIHNjYWxlLFxuICAgICAqIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsU2NhbGV9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpO1xuICAgICAqIHNjYWxlLnggPSAxMDA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZShzY2FsZSk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxTY2FsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxTY2FsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGxvY2FsIHRyYW5zZm9ybSBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS4gVGhpcyBtYXRyaXggaXMgdGhlIHRyYW5zZm9ybSByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBub2RlJ3MgcGFyZW50J3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3MgbG9jYWwgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdHJhbnNmb3JtID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxUcmFuc2Zvcm0oKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFRyYW5zZm9ybSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMubG9jYWxQb3NpdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uLCB0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgcG9zaXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBJbiBvcmRlclxuICAgICAqIHRvIHNldCB0aGUgd29ybGQtc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldFBvc2l0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBwb3NpdGlvbiA9IHRoaXMuZW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogcG9zaXRpb24ueCA9IDEwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBnZXRQb3NpdGlvbigpIHtcbiAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFRyYW5zbGF0aW9uKHRoaXMucG9zaXRpb24pO1xuICAgICAgICByZXR1cm4gdGhpcy5wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgUXVhdH0uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXJcbiAgICAgKiB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRSb3RhdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGEgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvdGF0aW9uID0gdGhpcy5lbnRpdHkuZ2V0Um90YXRpb24oKTtcbiAgICAgKi9cbiAgICBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgdGhpcy5yb3RhdGlvbi5zZXRGcm9tTWF0NCh0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gdGhpcy5yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJldHVybmVkIHZhbHVlIHdpbGwgb25seSBiZVxuICAgICAqIGNvcnJlY3QgZm9yIGdyYXBoIG5vZGVzIHRoYXQgaGF2ZSBhIG5vbi1za2V3ZWQgd29ybGQgdHJhbnNmb3JtIChhIHNrZXcgY2FuIGJlIGludHJvZHVjZWQgYnlcbiAgICAgKiB0aGUgY29tcG91bmRpbmcgb2Ygcm90YXRpb25zIGFuZCBzY2FsZXMgaGlnaGVyIGluIHRoZSBncmFwaCBub2RlIGhpZXJhcmNoeSkuIFRoZSBzY2FsZSBpc1xuICAgICAqIHJldHVybmVkIGFzIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZFxuICAgICAqIHJlYWQtb25seS4gTm90ZSB0aGF0IGl0IGlzIG5vdCBwb3NzaWJsZSB0byBzZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIG9mIGEgZ3JhcGggbm9kZVxuICAgICAqIGRpcmVjdGx5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0U2NhbGUoKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0U2NhbGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2NhbGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NjYWxlID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFNjYWxlKHRoaXMuX3NjYWxlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBmb3IgdGhpcyBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdHJhbnNmb3JtID0gdGhpcy5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgKi9cbiAgICBnZXRXb3JsZFRyYW5zZm9ybSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsICYmICF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMud29ybGRUcmFuc2Zvcm07XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudClcbiAgICAgICAgICAgIHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIHRoaXMuX3N5bmMoKTtcblxuICAgICAgICByZXR1cm4gdGhpcy53b3JsZFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGNhY2hlZCB2YWx1ZSBvZiBuZWdhdGl2ZSBzY2FsZSBvZiB0aGUgd29ybGQgdHJhbnNmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gLTEgaWYgd29ybGQgdHJhbnNmb3JtIGhhcyBuZWdhdGl2ZSBzY2FsZSwgMSBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB3b3JsZFNjYWxlU2lnbigpIHtcblxuICAgICAgICBpZiAodGhpcy5fd29ybGRTY2FsZVNpZ24gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3dvcmxkU2NhbGVTaWduID0gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLnNjYWxlU2lnbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl93b3JsZFNjYWxlU2lnbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZ3JhcGggbm9kZSBmcm9tIGN1cnJlbnQgcGFyZW50LlxuICAgICAqL1xuICAgIHJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5fcGFyZW50Py5yZW1vdmVDaGlsZCh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZ3JhcGggbm9kZSBmcm9tIGN1cnJlbnQgcGFyZW50IGFuZCBhZGQgYXMgY2hpbGQgdG8gbmV3IHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBwYXJlbnQgLSBOZXcgcGFyZW50IHRvIGF0dGFjaCBncmFwaCBub2RlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaW5kZXhdIC0gVGhlIGNoaWxkIGluZGV4IHdoZXJlIHRoZSBjaGlsZCBub2RlIHNob3VsZCBiZSBwbGFjZWQuXG4gICAgICovXG4gICAgcmVwYXJlbnQocGFyZW50LCBpbmRleCkge1xuICAgICAgICB0aGlzLnJlbW92ZSgpO1xuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5pbnNlcnRDaGlsZCh0aGlzLCBpbmRleCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhcmVudC5hZGRDaGlsZCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZSB1c2luZyBldWxlciBhbmdsZXMuIEV1bGVycyBhcmVcbiAgICAgKiBpbnRlcnByZXRlZCBpbiBYWVogb3JkZXIuIEV1bGVycyBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZSBldWxlclxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgZXVsZXJzIG9yIHJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZVxuICAgICAqIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB5LWF4aXMgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHktYXhpcyB2aWEgYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldExvY2FsRXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHBvcyA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHBvcyk7XG4gICAgICovXG4gICAgc2V0TG9jYWxQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgcXVhdGVybmlvbiBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdHxudW1iZXJ9IHggLSBRdWF0ZXJuaW9uIGhvbGRpbmcgbG9jYWwtc3BhY2Ugcm90YXRpb24gb3IgeC1jb21wb25lbnQgb2ZcbiAgICAgKiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd10gLSBXLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSA0IG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFJvdGF0aW9uKDAsIDAsIDAsIDEpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSBxdWF0ZXJuaW9uXG4gICAgICogY29uc3QgcSA9IHBjLlF1YXQoKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFJvdGF0aW9uKHEpO1xuICAgICAqL1xuICAgIHNldExvY2FsUm90YXRpb24oeCwgeSwgeiwgdykge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFF1YXQpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnNldCh4LCB5LCB6LCB3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHNjYWxlIGZhY3RvciBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2Ugc2NhbGUgb3IgeC1jb29yZGluYXRlXG4gICAgICogb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFNjYWxlKDEwLCAxMCwgMTApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBzY2FsZSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIHNldExvY2FsU2NhbGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTY2FsZS5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFNjYWxlLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5TG9jYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IHRydWU7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdW5mcmVlemVQYXJlbnRUb1Jvb3QoKSB7XG4gICAgICAgIGxldCBwID0gdGhpcy5fcGFyZW50O1xuICAgICAgICB3aGlsZSAocCkge1xuICAgICAgICAgICAgcC5fZnJvemVuID0gZmFsc2U7XG4gICAgICAgICAgICBwID0gcC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RpcnRpZnlXb3JsZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgdGhpcy5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcbiAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkSW50ZXJuYWwoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeVdvcmxkSW50ZXJuYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgdGhpcy5fZnJvemVuID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVdvcmxkID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NoaWxkcmVuW2ldLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fZGlydGlmeVdvcmxkSW50ZXJuYWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkU2NhbGVTaWduID0gMDsgICAvLyB3b3JsZCBtYXRyaXggaXMgZGlydHksIG1hcmsgdGhpcyBmbGFnIGRpcnR5IHRvb1xuICAgICAgICB0aGlzLl9hYWJiVmVyKys7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZVxuICAgICAqIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2UgcG9zaXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBzZXRQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpKS5pbnZlcnQoKTtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0Um90YXRpb24oMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHF1YXRlcm5pb25cbiAgICAgKiBjb25zdCBxID0gcGMuUXVhdCgpO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKHEpO1xuICAgICAqL1xuICAgIHNldFJvdGF0aW9uKHgsIHksIHosIHcpIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICByb3RhdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm90YXRpb24uc2V0KHgsIHksIHosIHcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkocm90YXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkoaW52UGFyZW50Um90KS5tdWwocm90YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlIHVzaW5nIGV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZVxuICAgICAqIGludGVycHJldGVkIGluIFhZWiBvcmRlci4gRXVsZXJzIG11c3QgYmUgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlIGV1bGVyXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBldWxlcnMgb3Igcm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlXG4gICAgICogeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyB2aWEgYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBzZXRFdWxlckFuZ2xlcyh4LCB5LCB6KSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIoaW52UGFyZW50Um90LCB0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgbmV3IGNoaWxkIHRvIHRoZSBjaGlsZCBsaXN0IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZiB0aGUgY2hpbGQgbm9kZS5cbiAgICAgKiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbmV3IGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGQoZSk7XG4gICAgICovXG4gICAgYWRkQ2hpbGQobm9kZSkge1xuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgY2hpbGQgdG8gdGhpcyBub2RlLCBtYWludGFpbmluZyB0aGUgY2hpbGQncyB0cmFuc2Zvcm0gaW4gd29ybGQgc3BhY2UuXG4gICAgICogSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtKGUpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0obm9kZSkge1xuXG4gICAgICAgIGNvbnN0IHdQb3MgPSBub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIGNvbnN0IHdSb3QgPSBub2RlLmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuXG4gICAgICAgIG5vZGUuc2V0UG9zaXRpb24odG1wTWF0NC5jb3B5KHRoaXMud29ybGRUcmFuc2Zvcm0pLmludmVydCgpLnRyYW5zZm9ybVBvaW50KHdQb3MpKTtcbiAgICAgICAgbm9kZS5zZXRSb3RhdGlvbih0bXBRdWF0LmNvcHkodGhpcy5nZXRSb3RhdGlvbigpKS5pbnZlcnQoKS5tdWwod1JvdCkpO1xuXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGEgbmV3IGNoaWxkIHRvIHRoZSBjaGlsZCBsaXN0IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mXG4gICAgICogdGhlIGNoaWxkIG5vZGUuIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBuZXcgY2hpbGQgdG8gaW5zZXJ0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBpbiB0aGUgY2hpbGQgbGlzdCBvZiB0aGUgcGFyZW50IHdoZXJlIHRoZSBuZXcgbm9kZSB3aWxsIGJlXG4gICAgICogaW5zZXJ0ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5Lmluc2VydENoaWxkKGUsIDEpO1xuICAgICAqL1xuICAgIGluc2VydENoaWxkKG5vZGUsIGluZGV4KSB7XG5cbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuICAgICAgICB0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDAsIG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByZXBhcmVzIG5vZGUgZm9yIGJlaW5nIGluc2VydGVkIHRvIGEgcGFyZW50IG5vZGUsIGFuZCByZW1vdmVzIGl0IGZyb20gdGhlIHByZXZpb3VzIHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5vZGUgYmVpbmcgaW5zZXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJlcGFyZUluc2VydENoaWxkKG5vZGUpIHtcblxuICAgICAgICAvLyByZW1vdmUgaXQgZnJvbSB0aGUgZXhpc3RpbmcgcGFyZW50XG4gICAgICAgIG5vZGUucmVtb3ZlKCk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KG5vZGUgIT09IHRoaXMsIGBHcmFwaE5vZGUgJHtub2RlPy5uYW1lfSBjYW5ub3QgYmUgYSBjaGlsZCBvZiBpdHNlbGZgKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmlzRGVzY2VuZGFudE9mKG5vZGUpLCBgR3JhcGhOb2RlICR7bm9kZT8ubmFtZX0gY2Fubm90IGFkZCBhbiBhbmNlc3RvciBhcyBhIGNoaWxkYCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZXMgYW4gZXZlbnQgb24gYWxsIGNoaWxkcmVuIG9mIHRoZSBub2RlLiBUaGUgZXZlbnQgYG5hbWVgIGlzIGZpcmVkIG9uIHRoZSBmaXJzdCAocm9vdClcbiAgICAgKiBub2RlIG9ubHkuIFRoZSBldmVudCBgbmFtZUhpZXJhcmNoeWAgaXMgZmlyZWQgZm9yIGFsbCBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIGZpcmUgb24gdGhlIHJvb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWVIaWVyYXJjaHkgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gZmlyZSBmb3IgYWxsIGRlc2NlbmRhbnRzLlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBwYXJlbnQgLSBUaGUgcGFyZW50IG9mIHRoZSBub2RlIGJlaW5nIGFkZGVkL3JlbW92ZWQgZnJvbSB0aGUgaGllcmFyY2h5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ZpcmVPbkhpZXJhcmNoeShuYW1lLCBuYW1lSGllcmFyY2h5LCBwYXJlbnQpIHtcbiAgICAgICAgdGhpcy5maXJlKG5hbWUsIHBhcmVudCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl9maXJlT25IaWVyYXJjaHkobmFtZUhpZXJhcmNoeSwgbmFtZUhpZXJhcmNoeSwgcGFyZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIGEgbm9kZSBpcyBpbnNlcnRlZCBpbnRvIGEgbm9kZSdzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBub2RlIHRoYXQgd2FzIGluc2VydGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uSW5zZXJ0Q2hpbGQobm9kZSkge1xuICAgICAgICBub2RlLl9wYXJlbnQgPSB0aGlzO1xuXG4gICAgICAgIC8vIHRoZSBjaGlsZCBub2RlIHNob3VsZCBiZSBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHkgb25seSBpZiBpdHNlbGYgaXMgZW5hYmxlZCBhbmQgaWZcbiAgICAgICAgLy8gdGhpcyBwYXJlbnQgaXMgZW5hYmxlZFxuICAgICAgICBjb25zdCBlbmFibGVkSW5IaWVyYXJjaHkgPSAobm9kZS5fZW5hYmxlZCAmJiB0aGlzLmVuYWJsZWQpO1xuICAgICAgICBpZiAobm9kZS5fZW5hYmxlZEluSGllcmFyY2h5ICE9PSBlbmFibGVkSW5IaWVyYXJjaHkpIHtcbiAgICAgICAgICAgIG5vZGUuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGVuYWJsZWRJbkhpZXJhcmNoeTtcblxuICAgICAgICAgICAgLy8gcHJvcGFnYXRlIHRoZSBjaGFuZ2UgdG8gdGhlIGNoaWxkcmVuIC0gbmVjZXNzYXJ5IGlmIHdlIHJlcGFyZW50IGEgbm9kZVxuICAgICAgICAgICAgLy8gdW5kZXIgYSBwYXJlbnQgd2l0aCBhIGRpZmZlcmVudCBlbmFibGVkIHN0YXRlIChpZiB3ZSByZXBhcmVudCBhIG5vZGUgdGhhdCBpc1xuICAgICAgICAgICAgLy8gbm90IGFjdGl2ZSBpbiB0aGUgaGllcmFyY2h5IHVuZGVyIGEgcGFyZW50IHdobyBpcyBhY3RpdmUgaW4gdGhlIGhpZXJhcmNoeSB0aGVuXG4gICAgICAgICAgICAvLyB3ZSB3YW50IG91ciBub2RlIHRvIGJlIGFjdGl2YXRlZClcbiAgICAgICAgICAgIG5vZGUuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkSW5IaWVyYXJjaHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGdyYXBoIGRlcHRoIG9mIHRoZSBjaGlsZCBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyB3aWxsIG5vdyBjaGFuZ2VcbiAgICAgICAgbm9kZS5fdXBkYXRlR3JhcGhEZXB0aCgpO1xuXG4gICAgICAgIC8vIFRoZSBjaGlsZCAocGx1cyBzdWJoaWVyYXJjaHkpIHdpbGwgbmVlZCB3b3JsZCB0cmFuc2Zvcm1zIHRvIGJlIHJlY2FsY3VsYXRlZFxuICAgICAgICBub2RlLl9kaXJ0aWZ5V29ybGQoKTtcbiAgICAgICAgLy8gbm9kZSBtaWdodCBiZSBhbHJlYWR5IG1hcmtlZCBhcyBkaXJ0eSwgaW4gdGhhdCBjYXNlIHRoZSB3aG9sZSBjaGFpbiBzdGF5cyBmcm96ZW4sIHNvIGxldCdzIGVuZm9yY2UgdW5mcmVlemVcbiAgICAgICAgaWYgKHRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIG5vZGUuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG5cbiAgICAgICAgLy8gYWxlcnQgYW4gZW50aXR5IGhpZXJhcmNoeSB0aGF0IGl0IGhhcyBiZWVuIGluc2VydGVkXG4gICAgICAgIG5vZGUuX2ZpcmVPbkhpZXJhcmNoeSgnaW5zZXJ0JywgJ2luc2VydGhpZXJhcmNoeScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGFsZXJ0IHRoZSBwYXJlbnQgdGhhdCBpdCBoYXMgaGFkIGEgY2hpbGQgaW5zZXJ0ZWRcbiAgICAgICAgaWYgKHRoaXMuZmlyZSkgdGhpcy5maXJlKCdjaGlsZGluc2VydCcsIG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY3Vyc2UgdGhlIGhpZXJhcmNoeSBhbmQgdXBkYXRlIHRoZSBncmFwaCBkZXB0aCBhdCBlYWNoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVHcmFwaERlcHRoKCkge1xuICAgICAgICB0aGlzLl9ncmFwaERlcHRoID0gdGhpcy5fcGFyZW50ID8gdGhpcy5fcGFyZW50Ll9ncmFwaERlcHRoICsgMSA6IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fdXBkYXRlR3JhcGhEZXB0aCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBub2RlIGZyb20gdGhlIGNoaWxkIGxpc3QgYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mIHRoZSBjaGlsZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBjaGlsZCAtIFRoZSBub2RlIHRvIHJlbW92ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGNoaWxkID0gdGhpcy5lbnRpdHkuY2hpbGRyZW5bMF07XG4gICAgICogdGhpcy5lbnRpdHkucmVtb3ZlQ2hpbGQoY2hpbGQpO1xuICAgICAqL1xuICAgIHJlbW92ZUNoaWxkKGNoaWxkKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fY2hpbGRyZW4uaW5kZXhPZihjaGlsZCk7XG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBmcm9tIGNoaWxkIGxpc3RcbiAgICAgICAgdGhpcy5fY2hpbGRyZW4uc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgICAvLyBDbGVhciBwYXJlbnRcbiAgICAgICAgY2hpbGQuX3BhcmVudCA9IG51bGw7XG5cbiAgICAgICAgLy8gTk9URTogc2VlIFBSICM0MDQ3IC0gdGhpcyBmaXggaXMgcmVtb3ZlZCBmb3Igbm93IGFzIGl0IGJyZWFrcyBvdGhlciB0aGluZ3NcbiAgICAgICAgLy8gbm90aWZ5IHRoZSBjaGlsZCBoaWVyYXJjaHkgaXQgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBwYXJlbnQsXG4gICAgICAgIC8vIHdoaWNoIG1hcmtzIHRoZW0gYXMgbm90IGVuYWJsZWQgaW4gaGllcmFyY2h5XG4gICAgICAgIC8vIGlmIChjaGlsZC5fZW5hYmxlZEluSGllcmFyY2h5KSB7XG4gICAgICAgIC8vICAgICBjaGlsZC5fbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKGNoaWxkLCBmYWxzZSk7XG4gICAgICAgIC8vIH1cblxuICAgICAgICAvLyBhbGVydCBjaGlsZHJlbiB0aGF0IHRoZXkgaGFzIGJlZW4gcmVtb3ZlZFxuICAgICAgICBjaGlsZC5fZmlyZU9uSGllcmFyY2h5KCdyZW1vdmUnLCAncmVtb3ZlaGllcmFyY2h5JywgdGhpcyk7XG5cbiAgICAgICAgLy8gYWxlcnQgdGhlIHBhcmVudCB0aGF0IGl0IGhhcyBoYWQgYSBjaGlsZCByZW1vdmVkXG4gICAgICAgIHRoaXMuZmlyZSgnY2hpbGRyZW1vdmUnLCBjaGlsZCk7XG4gICAgfVxuXG4gICAgX3N5bmMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcblxuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5V29ybGQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLmNvcHkodGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjYWxlQ29tcGVuc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRXb3JsZFNjYWxlO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9wYXJlbnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBhIHBhcmVudCBvZiB0aGUgZmlyc3QgdW5jb21wZW5zYXRlZCBub2RlIHVwIGluIHRoZSBoaWVyYXJjaHkgYW5kIHVzZSBpdHMgc2NhbGUgKiBsb2NhbFNjYWxlXG4gICAgICAgICAgICAgICAgICAgIGxldCBzY2FsZSA9IHRoaXMubG9jYWxTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50OyAvLyBjdXJyZW50IHBhcmVudFxuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50VG9Vc2VTY2FsZUZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChwYXJlbnRUb1VzZVNjYWxlRnJvbSAmJiBwYXJlbnRUb1VzZVNjYWxlRnJvbS5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50VG9Vc2VTY2FsZUZyb20uX3BhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvcG1vc3Qgbm9kZSB3aXRoIHNjYWxlIGNvbXBlbnNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VG9Vc2VTY2FsZUZyb20gPSBwYXJlbnRUb1VzZVNjYWxlRnJvbS5fcGFyZW50OyAvLyBub2RlIHdpdGhvdXQgc2NhbGUgY29tcGVuc2F0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkU2NhbGUgPSBwYXJlbnRUb1VzZVNjYWxlRnJvbS53b3JsZFRyYW5zZm9ybS5nZXRTY2FsZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZS5tdWwyKHBhcmVudFdvcmxkU2NhbGUsIHRoaXMubG9jYWxTY2FsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlID0gc2NhbGVDb21wZW5zYXRlU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUm90YXRpb24gaXMgYXMgdXN1YWxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90Mi5zZXRGcm9tTWF0NChwYXJlbnQud29ybGRUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QubXVsMihzY2FsZUNvbXBlbnNhdGVSb3QyLCB0aGlzLmxvY2FsUm90YXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgbWF0cml4IHRvIHRyYW5zZm9ybSBwb3NpdGlvblxuICAgICAgICAgICAgICAgICAgICBsZXQgdG1hdHJpeCA9IHBhcmVudC53b3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudC5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQubXVsMihwYXJlbnRXb3JsZFNjYWxlLCBwYXJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybS5zZXRUUlMocGFyZW50LndvcmxkVHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKHNjYWxlQ29tcGVuc2F0ZVBvcyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdDIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRtYXRyaXggPSBzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdG1hdHJpeC50cmFuc2Zvcm1Qb2ludCh0aGlzLmxvY2FsUG9zaXRpb24sIHNjYWxlQ29tcGVuc2F0ZVBvcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5zZXRUUlMoc2NhbGVDb21wZW5zYXRlUG9zLCBzY2FsZUNvbXBlbnNhdGVSb3QsIHNjYWxlKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0ubXVsQWZmaW5lMih0aGlzLl9wYXJlbnQud29ybGRUcmFuc2Zvcm0sIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fZGlydHlXb3JsZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cmljZXMgYXQgdGhpcyBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN5bmNIaWVyYXJjaHkoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9mcm96ZW4gPSB0cnVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsIHx8IHRoaXMuX2RpcnR5V29ybGQpIHtcbiAgICAgICAgICAgIHRoaXMuX3N5bmMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY2hpbGRyZW5baV0uc3luY0hpZXJhcmNoeSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVvcmllbnRzIHRoZSBncmFwaCBub2RlIHNvIHRoYXQgdGhlIG5lZ2F0aXZlIHotYXhpcyBwb2ludHMgdG93YXJkcyB0aGUgdGFyZ2V0LiBUaGlzXG4gICAgICogZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzLiBFaXRoZXIgcGFzcyAzRCB2ZWN0b3JzIGZvciB0aGUgbG9vayBhdCBjb29yZGluYXRlIGFuZCB1cFxuICAgICAqIHZlY3Rvciwgb3IgcGFzcyBudW1iZXJzIHRvIHJlcHJlc2VudCB0aGUgdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBJZiBwYXNzaW5nIGEgM0QgdmVjdG9yLCB0aGlzIGlzIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogT3RoZXJ3aXNlLCBpdCBpcyB0aGUgeC1jb21wb25lbnQgb2YgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBJZiBwYXNzaW5nIGEgM0QgdmVjdG9yLCB0aGlzIGlzIHRoZSB3b3JsZC1zcGFjZSB1cCB2ZWN0b3IgZm9yIGxvb2sgYXRcbiAgICAgKiB0cmFuc2Zvcm0uIE90aGVyd2lzZSwgaXQgaXMgdGhlIHktY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1eF0gLSBYLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1eV0gLSBZLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1el0gLSBaLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uIERlZmF1bHRzIHRvIDAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IGFub3RoZXIgZW50aXR5LCB1c2luZyB0aGUgKGRlZmF1bHQpIHBvc2l0aXZlIHktYXhpcyBmb3IgdXBcbiAgICAgKiBjb25zdCBwb3NpdGlvbiA9IG90aGVyRW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KHBvc2l0aW9uKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgYW5vdGhlciBlbnRpdHksIHVzaW5nIHRoZSBuZWdhdGl2ZSB3b3JsZCB5LWF4aXMgZm9yIHVwXG4gICAgICogY29uc3QgcG9zaXRpb24gPSBvdGhlckVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdChwb3NpdGlvbiwgcGMuVmVjMy5ET1dOKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgdGhlIHdvcmxkIHNwYWNlIG9yaWdpbiwgdXNpbmcgdGhlIChkZWZhdWx0KSBwb3NpdGl2ZSB5LWF4aXMgZm9yIHVwXG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KDAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxMCwgMTAsIDEwXSwgdXNpbmcgdGhlIG5lZ2F0aXZlIHdvcmxkIHktYXhpcyBmb3IgdXBcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQoMTAsIDEwLCAxMCwgMCwgLTEsIDApO1xuICAgICAqL1xuICAgIGxvb2tBdCh4LCB5LCB6LCB1eCA9IDAsIHV5ID0gMSwgdXogPSAwKSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGFyZ2V0LmNvcHkoeCk7XG5cbiAgICAgICAgICAgIGlmICh5IGluc3RhbmNlb2YgVmVjMykgeyAvLyB2ZWMzLCB2ZWMzXG4gICAgICAgICAgICAgICAgdXAuY29weSh5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIHZlYzNcbiAgICAgICAgICAgICAgICB1cC5jb3B5KFZlYzMuVVApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHogPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0LnNldCh4LCB5LCB6KTtcbiAgICAgICAgICAgIHVwLnNldCh1eCwgdXksIHV6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdHJpeC5zZXRMb29rQXQodGhpcy5nZXRQb3NpdGlvbigpLCB0YXJnZXQsIHVwKTtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbU1hdDQobWF0cml4KTtcbiAgICAgICAgdGhpcy5zZXRSb3RhdGlvbihyb3RhdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNsYXRlcyB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIHRyYW5zbGF0aW9uIHZlY3Rvci4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGVcbiAgICAgKiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlKDEwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgdmVjdG9yXG4gICAgICogY29uc3QgdCA9IG5ldyBwYy5WZWMzKDEwLCAwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGUodCk7XG4gICAgICovXG4gICAgdHJhbnNsYXRlKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgcG9zaXRpb24uYWRkKHRoaXMuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gbG9jYWwtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCB0cmFuc2xhdGlvbiB2ZWN0b3IuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlXG4gICAgICogbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZUxvY2FsKDEwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgdmVjdG9yXG4gICAgICogY29uc3QgdCA9IG5ldyBwYy5WZWMzKDEwLCAwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGVMb2NhbCh0KTtcbiAgICAgKi9cbiAgICB0cmFuc2xhdGVMb2NhbCh4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi50cmFuc2Zvcm1WZWN0b3IocG9zaXRpb24sIHBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmFkZChwb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIEV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZSBzcGVjaWZpZWQgaW5cbiAgICAgKiBkZWdyZWVzIGluIFhZWiBvcmRlci4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRFxuICAgICAqIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB3b3JsZC1zcGFjZSByb3RhdGlvbiBvclxuICAgICAqIHJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZSgwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlKHIpO1xuICAgICAqL1xuICAgIHJvdGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihyb3RhdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IHRoaXMuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgcm90YXRpb24ubXVsMihpbnZQYXJlbnRSb3QsIHJvdGF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKHJvdGF0aW9uLCByb3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyB0aGUgZ3JhcGggbm9kZSBpbiBsb2NhbC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIEV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZSBzcGVjaWZpZWQgaW5cbiAgICAgKiBkZWdyZWVzIGluIFhZWiBvcmRlci4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRFxuICAgICAqIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSByb3RhdGlvbiBvclxuICAgICAqIHJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZUxvY2FsKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgdmVjdG9yXG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGVMb2NhbChyKTtcbiAgICAgKi9cbiAgICByb3RhdGVMb2NhbCh4LCB5LCB6KSB7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsKHJvdGF0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdyYXBoTm9kZSB9O1xuIl0sIm5hbWVzIjpbInNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybSIsIk1hdDQiLCJzY2FsZUNvbXBlbnNhdGVQb3MiLCJWZWMzIiwic2NhbGVDb21wZW5zYXRlUm90IiwiUXVhdCIsInNjYWxlQ29tcGVuc2F0ZVJvdDIiLCJzY2FsZUNvbXBlbnNhdGVTY2FsZSIsInNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50IiwidG1wTWF0NCIsInRtcFF1YXQiLCJwb3NpdGlvbiIsImludlBhcmVudFd0bSIsInJvdGF0aW9uIiwiaW52UGFyZW50Um90IiwibWF0cml4IiwidGFyZ2V0IiwidXAiLCJjcmVhdGVUZXN0IiwiYXR0ciIsInZhbHVlIiwiRnVuY3Rpb24iLCJub2RlIiwieCIsImZpbmROb2RlIiwidGVzdCIsImNoaWxkcmVuIiwiX2NoaWxkcmVuIiwibGVuIiwibGVuZ3RoIiwiaSIsInJlc3VsdCIsIkdyYXBoTm9kZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibmFtZSIsInRhZ3MiLCJUYWdzIiwiX2xhYmVscyIsImxvY2FsUG9zaXRpb24iLCJsb2NhbFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsImxvY2FsRXVsZXJBbmdsZXMiLCJldWxlckFuZ2xlcyIsIl9zY2FsZSIsImxvY2FsVHJhbnNmb3JtIiwiX2RpcnR5TG9jYWwiLCJfYWFiYlZlciIsIl9mcm96ZW4iLCJ3b3JsZFRyYW5zZm9ybSIsIl9kaXJ0eVdvcmxkIiwiX3dvcmxkU2NhbGVTaWduIiwiX25vcm1hbE1hdHJpeCIsIk1hdDMiLCJfZGlydHlOb3JtYWwiLCJfcmlnaHQiLCJfdXAiLCJfZm9yd2FyZCIsIl9wYXJlbnQiLCJfZ3JhcGhEZXB0aCIsIl9lbmFibGVkIiwiX2VuYWJsZWRJbkhpZXJhcmNoeSIsInNjYWxlQ29tcGVuc2F0aW9uIiwicmlnaHQiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImdldFgiLCJub3JtYWxpemUiLCJnZXRZIiwiZm9yd2FyZCIsImdldFoiLCJtdWxTY2FsYXIiLCJub3JtYWxNYXRyaXgiLCJub3JtYWxNYXQiLCJpbnZlcnRNYXQ0IiwidHJhbnNwb3NlIiwiZW5hYmxlZCIsIl90aGlzJF9wYXJlbnQiLCJfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwicGFyZW50IiwicGF0aCIsInJvb3QiLCJncmFwaERlcHRoIiwiX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwiYyIsIl91bmZyZWV6ZVBhcmVudFRvUm9vdCIsIl9jbG9uZUludGVybmFsIiwiY2xvbmUiLCJfbGlzdCIsImNsZWFyIiwiYWRkIiwiT2JqZWN0IiwiYXNzaWduIiwiY29weSIsInNvdXJjZSIsImRlc3Ryb3kiLCJyZW1vdmUiLCJjaGlsZCIsInBvcCIsImZpcmUiLCJvZmYiLCJmaW5kIiwicmVzdWx0cyIsImZvckVhY2giLCJwdXNoIiwiZmluZE9uZSIsImZpbmRCeVRhZyIsInF1ZXJ5IiwiYXJndW1lbnRzIiwicXVlcnlOb2RlIiwiY2hlY2tOb2RlIiwiaGFzIiwiZmluZEJ5TmFtZSIsImZpbmRCeVBhdGgiLCJwYXJ0cyIsIkFycmF5IiwiaXNBcnJheSIsInNwbGl0IiwiaW1heCIsImNhbGxiYWNrIiwidGhpc0FyZyIsImNhbGwiLCJpc0Rlc2NlbmRhbnRPZiIsImlzQW5jZXN0b3JPZiIsImdldEV1bGVyQW5nbGVzIiwiZ2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldExvY2FsUG9zaXRpb24iLCJnZXRMb2NhbFJvdGF0aW9uIiwiZ2V0TG9jYWxTY2FsZSIsImdldExvY2FsVHJhbnNmb3JtIiwic2V0VFJTIiwiZ2V0UG9zaXRpb24iLCJnZXRUcmFuc2xhdGlvbiIsImdldFJvdGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRTY2FsZSIsIl9zeW5jIiwid29ybGRTY2FsZVNpZ24iLCJzY2FsZVNpZ24iLCJfdGhpcyRfcGFyZW50MiIsInJlbW92ZUNoaWxkIiwicmVwYXJlbnQiLCJpbmRleCIsImluc2VydENoaWxkIiwiYWRkQ2hpbGQiLCJzZXRMb2NhbEV1bGVyQW5nbGVzIiwieSIsInoiLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJfZGlydGlmeUxvY2FsIiwic2V0TG9jYWxQb3NpdGlvbiIsInNldCIsInNldExvY2FsUm90YXRpb24iLCJ3Iiwic2V0TG9jYWxTY2FsZSIsIl9kaXJ0aWZ5V29ybGQiLCJwIiwiX2RpcnRpZnlXb3JsZEludGVybmFsIiwic2V0UG9zaXRpb24iLCJpbnZlcnQiLCJ0cmFuc2Zvcm1Qb2ludCIsInNldFJvdGF0aW9uIiwicGFyZW50Um90IiwibXVsIiwic2V0RXVsZXJBbmdsZXMiLCJtdWwyIiwiX3ByZXBhcmVJbnNlcnRDaGlsZCIsIl9vbkluc2VydENoaWxkIiwiYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtIiwid1BvcyIsIndSb3QiLCJzcGxpY2UiLCJEZWJ1ZyIsImFzc2VydCIsIl9maXJlT25IaWVyYXJjaHkiLCJuYW1lSGllcmFyY2h5IiwiZW5hYmxlZEluSGllcmFyY2h5IiwiX3VwZGF0ZUdyYXBoRGVwdGgiLCJpbmRleE9mIiwicGFyZW50V29ybGRTY2FsZSIsInNjYWxlIiwicGFyZW50VG9Vc2VTY2FsZUZyb20iLCJ0bWF0cml4IiwibXVsQWZmaW5lMiIsInN5bmNIaWVyYXJjaHkiLCJsb29rQXQiLCJ1eCIsInV5IiwidXoiLCJVUCIsInVuZGVmaW5lZCIsInNldExvb2tBdCIsInRyYW5zbGF0ZSIsInRyYW5zbGF0ZUxvY2FsIiwidHJhbnNmb3JtVmVjdG9yIiwicm90YXRlIiwicm90Iiwicm90YXRlTG9jYWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBU0EsTUFBTUEsMkJBQTJCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDOUMsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDckMsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDckMsTUFBTUMsbUJBQW1CLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDdEMsTUFBTUUsb0JBQW9CLEdBQUcsSUFBSUosSUFBSSxFQUFFLENBQUE7QUFDdkMsTUFBTUssNkJBQTZCLEdBQUcsSUFBSUwsSUFBSSxFQUFFLENBQUE7QUFDaEQsTUFBTU0sT0FBTyxHQUFHLElBQUlSLElBQUksRUFBRSxD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
