import { Test, TestingModule } from '@nestjs/testing';
import { GitoperationController } from './gitoperation.controller';

describe('GitoperationController', () => {
  let controller: GitoperationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GitoperationController],
    }).compile();

    controller = module.get<GitoperationController>(GitoperationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
