type TokenType = 'number' | 'string' | 'boolean' | 'identifier' | 'operator' | 'leftParen' | 'rightParen' | 'eof'

interface Token {
  type: TokenType
  value: string
}

const operators = ['<=', '>=', '==', '!=', '&&', '||', '<', '>', '+', '-', '*', '/']
const precedence: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
}

class Tokenizer {
  private index = 0

  constructor(private readonly source: string) {}

  next(): Token {
    while (/\s/.test(this.source[this.index] || '')) this.index += 1
    if (this.index >= this.source.length) return { type: 'eof', value: '' }

    const character = this.source[this.index]
    if (character === '(') {
      this.index += 1
      return { type: 'leftParen', value: character }
    }
    if (character === ')') {
      this.index += 1
      return { type: 'rightParen', value: character }
    }
    if (character === '"' || character === "'") return this.readString(character)
    if (/\d/.test(character) || (character === '.' && /\d/.test(this.source[this.index + 1] || ''))) return this.readNumber()
    if (/[A-Za-z_$]/.test(character)) return this.readIdentifier()

    const operator = operators.find((candidate) => this.source.startsWith(candidate, this.index))
    if (operator) {
      this.index += operator.length
      return { type: 'operator', value: operator }
    }
    throw new Error(`Unsupported token "${character}" at position ${this.index + 1}.`)
  }

  private readString(quote: string): Token {
    this.index += 1
    let value = ''
    while (this.index < this.source.length) {
      const character = this.source[this.index]
      if (character === quote) {
        this.index += 1
        return { type: 'string', value }
      }
      if (character === '\\') {
        const escaped = this.source[this.index + 1]
        const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" }
        if (!(escaped in escapes)) throw new Error(`Unsupported escape sequence \\${escaped}.`)
        value += escapes[escaped]
        this.index += 2
      } else {
        value += character
        this.index += 1
      }
    }
    throw new Error('Unterminated string literal.')
  }

  private readNumber(): Token {
    const start = this.index
    while (/[\d.]/.test(this.source[this.index] || '')) this.index += 1
    const value = this.source.slice(start, this.index)
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) throw new Error(`Invalid number "${value}".`)
    return { type: 'number', value }
  }

  private readIdentifier(): Token {
    const start = this.index
    while (/[A-Za-z0-9_$]/.test(this.source[this.index] || '')) this.index += 1
    const value = this.source.slice(start, this.index)
    if (value === 'true' || value === 'false') return { type: 'boolean', value }
    return { type: 'identifier', value }
  }
}

class Parser {
  private current: Token

  constructor(
    private readonly tokenizer: Tokenizer,
    private readonly context: Record<string, unknown>,
  ) {
    this.current = tokenizer.next()
  }

  parse(): unknown {
    const result = this.parseExpression(0)
    if (this.current.type !== 'eof') throw new Error(`Unexpected token "${this.current.value}".`)
    return result
  }

  private advance() {
    this.current = this.tokenizer.next()
  }

  private parseExpression(minPrecedence: number): unknown {
    let left = this.parsePrimary()
    while (this.current.type === 'operator' && precedence[this.current.value] >= minPrecedence) {
      const operator = this.current.value
      const operatorPrecedence = precedence[operator]
      this.advance()
      const right = this.parseExpression(operatorPrecedence + 1)
      left = applyOperator(operator, left, right)
    }
    return left
  }

  private parsePrimary(): unknown {
    const token = this.current
    if (token.type === 'operator' && token.value === '-') {
      this.advance()
      const value = this.parsePrimary()
      if (typeof value !== 'number') throw new Error('Unary minus requires a number.')
      return -value
    }
    if (token.type === 'leftParen') {
      this.advance()
      const value = this.parseExpression(0)
      if (this.current.type !== 'rightParen') throw new Error('Missing closing parenthesis.')
      this.advance()
      return value
    }
    if (token.type === 'number') {
      this.advance()
      return Number(token.value)
    }
    if (token.type === 'string') {
      this.advance()
      return token.value
    }
    if (token.type === 'boolean') {
      this.advance()
      return token.value === 'true'
    }
    if (token.type === 'identifier') {
      this.advance()
      if (!Object.prototype.hasOwnProperty.call(this.context, token.value) || this.context[token.value] === undefined) {
        throw new Error(`Missing variable "${token.value}".`)
      }
      return this.context[token.value]
    }
    throw new Error(`Expected a value but found "${token.value || 'end of expression'}".`)
  }
}

function applyOperator(operator: string, left: unknown, right: unknown): unknown {
  switch (operator) {
    case '||': return Boolean(left) || Boolean(right)
    case '&&': return Boolean(left) && Boolean(right)
    case '==': return left === right
    case '!=': return left !== right
    case '<': return (left as number | string) < (right as number | string)
    case '<=': return (left as number | string) <= (right as number | string)
    case '>': return (left as number | string) > (right as number | string)
    case '>=': return (left as number | string) >= (right as number | string)
    case '+':
      if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right)
      if (typeof left === 'number' && typeof right === 'number') return left + right
      throw new Error('Addition requires numbers or strings.')
    case '-':
    case '*':
    case '/': {
      if (typeof left !== 'number' || typeof right !== 'number') throw new Error(`${operator} requires numeric operands.`)
      if (operator === '/' && right === 0) throw new Error('Division by zero.')
      if (operator === '-') return left - right
      if (operator === '*') return left * right
      return left / right
    }
    default: throw new Error(`Unsupported operator "${operator}".`)
  }
}

export function evaluateExpression(expression: string, context: Record<string, unknown>): unknown {
  const trimmed = expression.trim()
  if (!trimmed) throw new Error('Expression is empty.')
  return new Parser(new Tokenizer(trimmed), context).parse()
}
