import { MigrationDefinition, MigrationAnalysis, WorkspaceInfo, ProjectInfo } from '../types';

export const reactClassToHooksMigration: MigrationDefinition = {
    id: 'react-class-to-hooks',
    name: 'React Class Components to Hooks',
    description: 'Convert React class components to functional components with hooks',
    appliesTo: (projectInfo: ProjectInfo) => {
        return projectInfo.type === 'react' && !!projectInfo.hasJSX;
    },
    analyze: async (workspace: WorkspaceInfo): Promise<MigrationAnalysis> => {
        const classComponents: string[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];

        // Find React class components
        for (const file of workspace.files) {
            if ((file.languageId === 'javascriptreact' || file.languageId === 'typescriptreact') &&
                ((file.content.includes('class ') && file.content.includes('extends React.Component')) ||
                 file.content.includes('extends Component'))) {
                classComponents.push(file.relativePath);
            }
        }

        if (classComponents.length === 0) {
            return {
                applicable: false,
                filesToMigrate: [],
                estimatedComplexity: 'low',
                warnings: ['No React class components found'],
                recommendations: [],
                summary: 'No React class components detected in the workspace'
            };
        }

        warnings.push('Complex class components with lifecycle methods may need manual review');
        warnings.push('Error boundaries and some advanced patterns may not convert automatically');
        
        recommendations.push('Ensure React version >= 16.8 (hooks support)');
        recommendations.push('Review converted components for proper hook dependencies');
        recommendations.push('Test all converted components thoroughly');

        const complexity = classComponents.length > 20 ? 'high' : classComponents.length > 10 ? 'medium' : 'low';

        return {
            applicable: true,
            filesToMigrate: classComponents,
            estimatedComplexity: complexity,
            warnings,
            recommendations,
            summary: `Found ${classComponents.length} React class component(s) that can be converted to hooks`
        };
    },
    aiRewriteInstruction: `You are converting React class components to functional components with hooks. For each class component:

1. Convert class to function:
   - class MyComponent extends React.Component -> function MyComponent(props)
   - Remove 'this' references
   - Use props directly instead of this.props

2. Convert state:
   - this.state = { ... } -> const [state, setState] = useState({ ... })
   - this.setState({ ... }) -> setState({ ... })
   - Multiple state variables should be split into separate useState calls

3. Convert lifecycle methods:
   - componentDidMount() -> useEffect(() => {}, [])
   - componentDidUpdate(prevProps, prevState) -> useEffect(() => { ... }, [dependencies])
   - componentWillUnmount() -> useEffect(() => { return () => { ... } }, [])
   - getDerivedStateFromProps -> useEffect with props as dependency

4. Convert methods:
   - Class methods -> regular functions inside the component
   - Bind handlers if needed, or use useCallback

5. Preserve all functionality and behavior

6. Add proper TypeScript types if applicable:
   - React.FC<Props> or (props: Props) => JSX.Element

Return a RefactorPlan with:
- edits: Convert class components to functional components with hooks
- summary: Description of hooks used and lifecycle conversions`
};

