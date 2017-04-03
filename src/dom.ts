import xs, { Stream } from 'xstream'
import fromEvent from 'xstream/extra/fromEvent'
import dropRepeats from 'xstream/extra/dropRepeats'

(window as any).xs = xs

export type ElementType = string

export interface VNode {
  type: ElementType,
  className?: string,
  children: Children,
  node?: Element,
  visible$?: Stream<boolean>,
}

export type Children = string | VNode | Stream<string> | Array<string | VNode | Stream<string>>

export interface VNodeProps {
  visible$?: Stream<boolean>,
}

export function h(selector: string, props: VNodeProps, children: Children): VNode {
  const [ type, className ] = selector.split('.')
  return {
    type,
    className,
    children,
    visible$: props.visible$,
  }
}

function arrify(children: Children): Array<string | VNode | Stream<string>> {
  return Array.isArray(children) ? children : [children]
}

function error(err: Error) {
  console.error(err)
}

function createDOM(root: Element, tree: string | VNode): void {
  if (typeof tree === 'string') {
    root.innerHTML = tree
    return
  }

  const children = arrify(tree.children)

  children
    .forEach(child => {
      if (child instanceof Stream) {
        const node = children.length > 1
          ? document.createElement('span')
          : root
        if (children.length > 1) {
          root.appendChild(node)
        }
        child.addListener({
          next: str => {
            node.innerHTML = str
          },
          error,
        })
        return
      }

      if (typeof child === 'string') {
        if (children.length === 1) {
          root.innerHTML = child
          return
        }

        const node = document.createElement('span')
        node.innerHTML = child
        root.appendChild(node)
        return
      }

      const createNode = (vnode: VNode) => {
        const node = document.createElement(vnode.type)
        if (vnode.className) {
          node.className = vnode.className
        }
        createDOM(node, vnode)
        return node
      }

      const visible$ = child.visible$ || xs.of(true)


      visible$
        .take(1)
        .addListener({
          next: state => {
            // node does not exits here
            if (state) {
              root.appendChild(createNode(child))
            }
          },
          error,
        })

      visible$
        .compose(dropRepeats())
        .drop(1)
        .addListener({
          next: state => {
            // last state was equal !state
            if (state) {
              child.node = root.appendChild(createNode(child))
            } else {
              child.node!.remove()
            }
          },
          error,
        })
    })
}

export class DOMSource {
  private root: Element
  private namespace: string[]

  public constructor(root: Element, namespace: string[] = []) {
    this.root = root
    this.namespace = namespace
  }

  public selectEvents(selector: string, eventName: string) {
    return fromEvent(this.root, eventName)
      .filter(event => event.target.matches(selector))
  }
}

export function makeDOMDriver(selector: string) {
  const root = document.querySelector(selector)
  if (!root) {
    throw new Error(`makeDOMDriver(...): Cannot find element with selector \`${selector}\``)
  }

  return function domDriver(tree$: Stream<VNode>) {
    console.log('dom driver')
    tree$.take(1).addListener({
      next: tree => {
        root.innerHTML = ''
        createDOM(root, tree)
      },
      error: err => console.log(err),
    })

    return new DOMSource(root)
  }
}