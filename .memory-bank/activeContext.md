# Active Context: Web SQLite V2

## Current Work Focus

### Primary Development Areas

**TypeScript Migration Progress**

- Currently working on migrating JavaScript (.mjs) modules to TypeScript
- Recent focus on VFS module conversion, including memfs and OPFS components
- Maintaining backward compatibility while enhancing type safety
- Dual compilation strategy for ESM output preservation

**Module Refactoring**

- Restructuring monolithic modules into modular directory structures
- Improving separation of concerns between different VFS implementations
- Enhancing error handling and type safety across the codebase

**Documentation Updates**

- Revised coding standards in `.clinerules/base_rules.md`
- Updated repository guidelines in `AGENTS.md`
- AI agent rules in `CLAUDE.md`
- Added new migration and test specs

### Recent Changes

**Memfs Module Migration**

- Refactored from `src/jswasm/vfs/` to `src/jswasm/vfs/memfs/` directory
- Converted from JavaScript (.mjs) to TypeScript (.ts)
- Added comprehensive unit test file
- Updated TypeScript configuration files

**OPFS Module Improvements**

- Migrated OPFS SAHPOOL VFS from JavaScript to TypeScript
- Improved type safety in OPFS installer module
- Refactored OPFS VFS installer module structure
- Added migration specs and test plans for OPFS modules

**Documentation Updates**

- Revised coding standards in `.clinerules/base_rules.md`
- Updated repository guidelines in `AGENTS.md`
- AI agent rules in `CLAUDE.md`
- Added docs/development/lint-any-cleanup-spec.md
- Updated GEMINI.md for task progress tracking

## Active Decisions and Considerations

### Architectural Decisions

**Gradual TypeScript Migration**

- Decision: Maintain .mjs files for ESM compatibility while developing new features in TypeScript
- Rationale: Ensures backward compatibility while improving developer experience
- Impact: Requires dual maintenance but provides smoother transition path

**VFS Modularization**

- Decision: Split VFS implementations into separate directories (memfs/, opfs/)
- Rationale: Improves maintainability and allows for easier addition of new VFS implementations
- Impact: Requires updating import paths but provides cleaner module organization

**Documentation Standardization**

- Decision: Update and expand coding standards and guidelines
- Rationale: Ensures consistent code quality across the project
- Impact: Requires developers to follow new standards but improves long-term maintainability

### Technical Considerations

**Memory Management Strategy**

- Current: SharedArrayBuffer for cross-context operations
- Consideration: Balancing performance vs. browser compatibility
- Decision: Maintain SharedArrayBuffer with graceful degradation fallbacks

**Type Safety**

- Current: Strict TypeScript mode for all migrated modules
- Consideration: Removing 'any' types and improving type safety
- Decision: Prioritize type safety across all modules

## Development Patterns and Preferences

### Code Style Preferences

**TypeScript Usage**

- Strict mode enabled for all new modules
- Explicit type annotations for public APIs
- Generic types for flexible operations
- JSDoc comments for complex business logic

**Module Organization**

- Factory pattern for module creation
- Dependency injection for testability
- Clear separation of public vs. private interfaces
- Consistent naming conventions across modules

**Error Handling Patterns**

- Hierarchical error type system
- Promise-based error propagation
- Context preservation through error chaining
- Graceful degradation for unsupported features

### Testing Preferences

**Unit Testing**

- Vitest for fast unit test execution
- Comprehensive coverage for utility modules
- Mock implementations for browser APIs
- Integration tests for critical paths

**Browser Testing**

- Real browser testing over simulation
- Cross-browser compatibility verification
- Performance benchmarking integration
- Automated visual regression testing

## Important Insights and Learnings

### Performance Insights

**OPFS Performance Characteristics**

- Sector-aligned operations significantly improve throughput
- Synchronous access in workers provides major performance benefits
- Cross-context synchronization overhead is minimal with SharedArrayBuffer
- Memory-mapped file operations outgrow traditional I/O for large datasets

**TypeScript Migration Benefits**

- Early detection of type-related errors
- Improved IDE support and developer productivity
- Better documentation through type annotations
- Enhanced code maintainability

### Development Process Learnings

**Migration Strategy Effectiveness**

- Gradual migration from JavaScript to TypeScript reduces risk
- Maintaining ESM output preserves backward compatibility
- Comprehensive test coverage essential for safe refactoring
- Documentation must evolve with code changes

**Modularization Benefits**

- Improved code discoverability
- Easier to test individual components
- Better separation of concerns
- Enhanced scalability

## Next Immediate Steps

### Short-term Priorities (Next 2-4 weeks)

**Complete TypeScript Migration**

- Continue migrating remaining VFS modules
- Enhance type definitions for better IDE support
- Improve error messages with type context
- Update documentation to reflect TypeScript changes

**Performance Optimization**

- Benchmark and optimize hot paths
- Improve memory usage patterns
- Enhance OPFS sector management
- Optimize WASM initialization time

**Testing Enhancement**

- Expand browser test coverage
- Add performance regression tests
- Improve automated verification
- Enhance error case testing

### Medium-term Priorities (Next 1-3 months)

**Feature Enhancement**

- Enhanced query optimization hints
- Improved connection pooling
- Advanced OPFS features
- Better error recovery mechanisms

**Developer Experience**

- Enhanced debugging tools
- Improved documentation examples
- Performance profiling utilities
- Migration guides for common scenarios

**Ecosystem Integration**

- Better integration with popular frameworks
- Enhanced tooling support
- Improved build system integration
- Additional language bindings

### Technical Debt Management

**Code Quality**

- Continue refactoring for better separation of concerns
- Improve test coverage for edge cases
- Enhance error handling consistency
- Optimize bundle sizes further

**Documentation**

- Keep API documentation synchronized with code
- Add more practical examples
- Improve troubleshooting guides
- Enhance performance tuning documentation

**Infrastructure**

- Improve CI/CD pipelines
- Enhance automated testing
- Better release process automation
- Improved dependency management

## Risk Assessment and Mitigation

### Current Risks

**Browser Compatibility**

- Risk: OPFS adoption gaps in older browsers
- Mitigation: Graceful degradation to IndexedDB fallback
- Monitoring: Browser usage statistics and feature detection

**Performance Regression**

- Risk: New features impacting performance
- Mitigation: Comprehensive performance testing
- Monitoring: Automated benchmarking and alerting

**Complexity Management**

- Risk: Growing codebase complexity
- Mitigation: Strict architectural patterns and regular refactoring
- Monitoring: Code metrics and architectural reviews

**Upstream Dependency Changes**

- Risk: SQLite or Emscripten updates breaking compatibility
- Mitigation: Comprehensive test suite and version pinning
- Monitoring: Upstream change tracking and timely updates

### Mitigation Strategies

**Testing Strategy**

- Comprehensive automated testing across browsers
- Performance regression detection
- Cross-platform compatibility verification
- Continuous integration with extensive checks

**Documentation Strategy**

- Living documentation that evolves with code
- Comprehensive migration guides
- Troubleshooting documentation for common issues
- Performance tuning guides

**Community Engagement**

- Regular communication about changes
- Clear migration paths for breaking changes
- Community feedback incorporation
- Contribution guidelines and support
