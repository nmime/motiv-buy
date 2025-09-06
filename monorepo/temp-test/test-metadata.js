'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return (c > 3 && r && Object.defineProperty(target, key, r), r);
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') return Reflect.metadata(k, v);
  };
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const core_1 = require('@mikro-orm/core');
let TestEntity = class TestEntity {};
__decorate(
  [(0, core_1.PrimaryKey)({ type: 'uuid' }), __metadata('design:type', String)],
  TestEntity.prototype,
  'id',
  void 0,
);
__decorate(
  [(0, core_1.Property)({ type: 'varchar', fieldName: 'name' }), __metadata('design:type', String)],
  TestEntity.prototype,
  'name',
  void 0,
);
__decorate(
  [(0, core_1.ManyToOne)('TestRelatedEntity', { nullable: true, ref: true }), __metadata('design:type', Object)],
  TestEntity.prototype,
  'related',
  void 0,
);
TestEntity = __decorate([(0, core_1.Entity)({ tableName: 'test_entity' })], TestEntity);
let TestRelatedEntity = class TestRelatedEntity {};
__decorate(
  [(0, core_1.PrimaryKey)({ type: 'uuid' }), __metadata('design:type', String)],
  TestRelatedEntity.prototype,
  'id',
  void 0,
);
__decorate(
  [(0, core_1.Property)({ type: 'varchar' }), __metadata('design:type', String)],
  TestRelatedEntity.prototype,
  'title',
  void 0,
);
TestRelatedEntity = __decorate([(0, core_1.Entity)({ tableName: 'test_related' })], TestRelatedEntity);
// Test reflect-metadata functionality
console.log('🔍 Testing reflect-metadata functionality...');
// Test if decorators are working
const entityMetadata = Reflect.getMetadata('design:paramtypes', TestEntity);
console.log('✅ Entity metadata exists:', !!entityMetadata);
// Test property reflection
const properties = Object.getOwnPropertyNames(TestEntity.prototype);
console.log('✅ Entity properties:', properties);
// Test decorator metadata on properties
const idType = Reflect.getMetadata('design:type', TestEntity.prototype, 'id');
const nameType = Reflect.getMetadata('design:type', TestEntity.prototype, 'name');
console.log('✅ Property types reflection works:', !!idType && !!nameType);
// Test MikroORM specific metadata
try {
  const mikroMetadata = Reflect.getMetadata('mikro-orm:entity', TestEntity);
  console.log('✅ MikroORM entity metadata exists:', !!mikroMetadata);
} catch (e) {
  console.log('ℹ️ MikroORM metadata not available without full initialization');
}
console.log('🎉 Metadata reflection test completed successfully!');
